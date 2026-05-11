from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional, Tuple
from ortools.sat.python import cp_model
import re

app = FastAPI(title="FacultyAide OR-Tools Scheduler")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _norm(s: Any) -> str:
    return str(s or "").strip().lower()


def _venue_family(v: "Venue") -> str:
    """Group venue into scheduling family for course–venue compatibility."""
    t = _norm(v.type)
    name = _norm(v.name)
    block = _norm(v.block)
    if t in ("virtual", "online") or "virtual" in name or name == "virtual hub":
        return "online"
    if t in ("lab", "laboratory"):
        if "physics" in name or block == "physics":
            return "physics_lab"
        return "computer_lab"
    if t == "studio":
        return "theory"
    if t in ("hall", "theatre", "classroom", ""):
        return "theory"
    return "theory"


def _course_delivery_family(course_type: Optional[str]) -> str:
    ct = _norm(course_type or "Theory")
    if ct == "online":
        return "online"
    if ct == "computing practical":
        return "computing_lab"
    if ct == "physics practical":
        return "physics_lab"
    if ct == "practical":
        return "general_lab"
    return "theory"


def venue_matches_course(course: "CourseConfig", v: "Venue") -> bool:
    """Theory → halls/studios only; labs only for practical types; online → virtual only."""
    need = _course_delivery_family(course.type)
    fam = _venue_family(v)
    if need == "online":
        return fam == "online"
    if need == "theory":
        return fam == "theory"
    if need == "computing_lab":
        return fam == "computer_lab"
    if need == "physics_lab":
        return fam == "physics_lab"
    if need == "general_lab":
        return fam in ("computer_lab", "physics_lab")
    return False


def is_online_venue(v: "Venue") -> bool:
    return _venue_family(v) == "online"


def section_key(course_id: str, is_section: bool) -> str:
    if not is_section:
        return "GEN"
    m = re.search(r"-S(\d+)$", str(course_id))
    return f"S{m.group(1)}" if m else "GEN"


def cohort_key(c: "CourseConfig") -> Tuple[str, str, str]:
    """(level, dept_bucket, section) — mirrors frontend timetableEngine group logic."""
    level = str(c.level if c.level is not None else "")
    dept = "ALL" if c.is_common else (c.department or "")
    sec = section_key(c.id, bool(c.is_section))
    return (level, dept, sec)


def parse_duration_hours(s: Optional[str]) -> int:
    if not s:
        return 2
    t = str(s).replace("h", "").strip()
    try:
        return max(1, int(t))
    except ValueError:
        return 2


def day_to_index(day_name: str, days_map: Dict[int, str]) -> Optional[int]:
    for idx, name in days_map.items():
        if name == day_name:
            return idx
    return None


def _restriction_window_hours(constraint: Dict[str, Any]) -> Optional[Tuple[int, int]]:
    """Forbidden window as 24h hours: [start, end) using teaching day bounds."""
    ts = constraint.get("timeSlot")
    if ts == "Morning":
        return (9, 13)
    if ts == "Afternoon":
        return (13, 18)
    if ts == "All Day":
        return (9, 18)
    start = constraint.get("start")
    end = constraint.get("end")
    if start is not None and end is not None:
        try:
            a, b = int(start), int(end)
            if a < b:
                return (a, b)
        except (TypeError, ValueError):
            pass
    return None


def _matches_course_code(c: "CourseConfig", code: Optional[str]) -> bool:
    if not code or not str(code).strip():
        return True
    code = str(code).strip()
    if str(c.code) == code:
        return True
    pc = c.parent_code
    if pc and str(pc) == code:
        return True
    if str(c.code).startswith(code + "-"):
        return True
    return False


def apply_exclusion_constraints(
    model: cp_model.CpModel,
    assignments: Dict[Tuple[str, str, int, int], Any],
    req: "GenerateRequest",
    durations: Dict[str, int],
    venues_work: List["Venue"],
    days_map: Dict[int, str],
    num_hours: int,
) -> None:
    """Apply Exclusion rules from Firestore (legacy) or AI-parsed NL."""
    for raw in req.constraints or []:
        ctype = str(raw.get("type") or "Exclusion").lower()
        if ctype != "exclusion":
            continue

        day_str = raw.get("day")
        day_idx = day_to_index(day_str, days_map) if day_str else None
        if day_idx is None:
            continue

        win = _restriction_window_hours(raw)
        if win is None:
            continue
        win_start_hr, win_end_hr = win

        dept_wide = bool(raw.get("departmentWide"))
        lect = raw.get("lecturer")
        course_code = raw.get("course")
        level = raw.get("level")

        targets: List[CourseConfig] = list(req.courses)
        if dept_wide:
            if level is not None and str(level).strip() != "":
                targets = [c for c in targets if str(c.level) == str(level)]
        else:
            if lect:
                targets = [c for c in targets if str(c.lecturer or "") == str(lect)]
            if course_code:
                targets = [c for c in targets if _matches_course_code(c, course_code)]
            if level is not None and str(level).strip() != "":
                targets = [c for c in targets if str(c.level) == str(level)]

        for c in targets:
            dur = durations[c.id]
            for s in range(num_hours - dur + 1):
                sess_start = 9 + s
                sess_end = sess_start + dur
                if sess_start < win_end_hr and sess_end > win_start_hr:
                    for v in venues_work:
                        key = (c.id, v.id, day_idx, s)
                        if key in assignments:
                            model.Add(assignments[key] == 0)


def cross_dept_occupancy(
    cross_dept_timetables: List[Dict[str, Any]],
    days_map: Dict[int, str],
    num_hours: int,
) -> Tuple[Dict[Tuple[str, int, int], bool], Dict[Tuple[str, int, int], bool]]:
    """
    Returns:
      venue_blocks: (venue_id, day_idx, hour_idx) — physical venue already taken
      lecturer_blocks: (lecturer_name, day_idx, hour_idx)
    """
    venue_blocks: Dict[Tuple[str, int, int], bool] = {}
    lecturer_blocks: Dict[Tuple[str, int, int], bool] = {}

    inv_days = {v: k for k, v in days_map.items()}

    for tt in cross_dept_timetables or []:
        for slot in tt.get("schedule") or []:
            day_name = slot.get("assignedDay")
            d = inv_days.get(day_name)
            if d is None:
                continue
            start = slot.get("assignedStart")
            if start is None:
                continue
            try:
                start = int(start)
            except (TypeError, ValueError):
                continue
            dur = parse_duration_hours(slot.get("duration") or slot.get("durationParams"))

            ven = slot.get("assignedVenue") or {}
            vid = ven.get("id") or ""
            vtype = _norm(ven.get("type"))
            if vid and vtype not in ("virtual", "online") and _norm(vid) not in ("virtual", "virtual-online"):
                for i in range(dur):
                    h_abs = start + i
                    h_idx = h_abs - 9
                    if 0 <= h_idx < num_hours:
                        venue_blocks[(str(vid), d, h_idx)] = True

            lect = slot.get("lecturer")
            if lect and str(lect) != "TBA":
                for i in range(dur):
                    h_abs = start + i
                    h_idx = h_abs - 9
                    if 0 <= h_idx < num_hours:
                        lecturer_blocks[(str(lect), d, h_idx)] = True

    return venue_blocks, lecturer_blocks


class CourseConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    code: str
    title: Optional[str] = None
    lecturer: Optional[str] = None
    students: Optional[Any] = 0
    duration: Optional[str] = "2h"
    type: Optional[str] = "Theory"
    level: Optional[str] = None
    sections: Optional[Any] = 1
    is_section: bool = Field(default=False, alias="isSection")
    parent_code: Optional[str] = Field(default=None, alias="parentCode")
    department: Optional[str] = None
    is_common: bool = Field(default=False, alias="isCommon")


class Venue(BaseModel):
    id: str
    name: str
    capacity: Optional[Any] = 0
    type: Optional[str] = None
    dept: Optional[str] = None
    block: Optional[str] = None


class GenerateRequest(BaseModel):
    courses: List[CourseConfig]
    venues: List[Venue]
    constraints: List[Dict[str, Any]]
    cross_dept_timetables: List[Dict[str, Any]]


@app.post("/generate_schedule")
async def generate_schedule(req: GenerateRequest):
    """
    Google OR-Tools CP-SAT: course ↔ venue type matching, lecturer / cohort / cross-dept clashes.
    """
    try:
        days_map = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday", 4: "Friday"}
        num_days = 5
        num_hours = 8

        durations = {c.id: parse_duration_hours(c.duration) for c in req.courses}

        # Inject a synthetic online venue if any online course and none exists in payload
        venues_work: List[Venue] = list(req.venues)
        has_online_course = any(_course_delivery_family(c.type) == "online" for c in req.courses)
        has_online_venue = any(is_online_venue(v) for v in venues_work)
        if has_online_course and not has_online_venue:
            venues_work.append(
                Venue(
                    id="virtual-online",
                    name="Online (Virtual Classroom)",
                    capacity=999999,
                    type="Virtual",
                    dept="General",
                    block="Virtual",
                )
            )

        ext_venue_blocks, ext_lecturer_blocks = cross_dept_occupancy(
            req.cross_dept_timetables, days_map, num_hours
        )

        model = cp_model.CpModel()
        assignments = {}

        for c in req.courses:
            dur = durations[c.id]
            try:
                c_students = int(c.students) if c.students else 0
            except (TypeError, ValueError):
                c_students = 0

            for v in venues_work:
                if not venue_matches_course(c, v):
                    continue
                try:
                    v_cap = int(v.capacity) if v.capacity else 0
                except (TypeError, ValueError):
                    v_cap = 0
                if not is_online_venue(v) and v_cap > 0 and c_students > v_cap:
                    continue

                for d in range(num_days):
                    for h in range(num_hours - dur + 1):
                        # External department already using this physical room
                        blocked_ext = False
                        if not is_online_venue(v):
                            for hh in range(h, h + dur):
                                if ext_venue_blocks.get((v.id, d, hh)):
                                    blocked_ext = True
                                    break
                        if blocked_ext:
                            continue

                        # External lecturing clash (same person teaching elsewhere)
                        lec = c.lecturer
                        if lec and str(lec) != "TBA":
                            for hh in range(h, h + dur):
                                if ext_lecturer_blocks.get((str(lec), d, hh)):
                                    blocked_ext = True
                                    break
                        if blocked_ext:
                            continue

                        assignments[(c.id, v.id, d, h)] = model.NewBoolVar(f"assign_c{c.id}_v{v.id}_d{d}_h{h}")

        is_scheduled = {}
        for c in req.courses:
            is_scheduled[c.id] = model.NewBoolVar(f"is_scheduled_c{c.id}")
            valid_starts = []
            for v in venues_work:
                for d in range(num_days):
                    for h in range(num_hours - durations[c.id] + 1):
                        key = (c.id, v.id, d, h)
                        if key in assignments:
                            valid_starts.append(assignments[key])
            if valid_starts:
                model.Add(sum(valid_starts) == is_scheduled[c.id])
            else:
                model.Add(is_scheduled[c.id] == 0)

        # Physical venue: at most one course per (venue, day, hour)
        for v in venues_work:
            if is_online_venue(v):
                continue
            for d in range(num_days):
                for h in range(num_hours):
                    active_courses = []
                    for c in req.courses:
                        dur = durations[c.id]
                        for start in range(max(0, h - dur + 1), min(h + 1, num_hours - dur + 1)):
                            key = (c.id, v.id, d, start)
                            if key in assignments:
                                active_courses.append(assignments[key])
                    if active_courses:
                        model.Add(sum(active_courses) <= 1)

        # Lecturer overlap (includes this dept + cross-dept preds)
        lecturers = list(
            set(str(c.lecturer) for c in req.courses if c.lecturer and str(c.lecturer) != "TBA")
        )
        for lecturer in lecturers:
            lecturer_courses = [c for c in req.courses if str(c.lecturer) == lecturer]
            for d in range(num_days):
                for h in range(num_hours):
                    active_for_lecturer = []
                    for c in lecturer_courses:
                        dur = durations[c.id]
                        for v in venues_work:
                            for start in range(max(0, h - dur + 1), min(h + 1, num_hours - dur + 1)):
                                key = (c.id, v.id, d, start)
                                if key in assignments:
                                    active_for_lecturer.append(assignments[key])
                    if active_for_lecturer:
                        cap = 1
                        if ext_lecturer_blocks.get((lecturer, d, h)):
                            cap = 0
                        model.Add(sum(active_for_lecturer) <= cap)

        # Student cohort: same level + department bucket + section cannot take two classes at once
        cohort_map: Dict[Tuple[str, str, str], List[CourseConfig]] = {}
        for c in req.courses:
            key = cohort_key(c)
            cohort_map.setdefault(key, []).append(c)

        for _cohort, clist in cohort_map.items():
            if len(clist) < 2:
                continue
            for d in range(num_days):
                for h in range(num_hours):
                    active = []
                    for c in clist:
                        dur = durations[c.id]
                        for v in venues_work:
                            for start in range(max(0, h - dur + 1), min(h + 1, num_hours - dur + 1)):
                                key = (c.id, v.id, d, start)
                                if key in assignments:
                                    active.append(assignments[key])
                    if active:
                        model.Add(sum(active) <= 1)

        # Common courses: cannot run at the same time as any other course at the same level
        # (matches frontend timetableEngine behaviour for shared/university-wide modules)
        level_set = sorted(
            {str(c.level) for c in req.courses if c.level is not None and str(c.level).strip() != ""}
        )
        for level in level_set:
            for d in range(num_days):
                for h in range(num_hours):
                    commons_vars: List[Any] = []
                    others_vars: List[Any] = []
                    for c in req.courses:
                        if str(c.level) != str(level):
                            continue
                        dur = durations[c.id]
                        for v in venues_work:
                            for start in range(max(0, h - dur + 1), min(h + 1, num_hours - dur + 1)):
                                key = (c.id, v.id, d, start)
                                if key in assignments:
                                    if c.is_common:
                                        commons_vars.append(assignments[key])
                                    else:
                                        others_vars.append(assignments[key])
                    if commons_vars and others_vars:
                        any_common = model.NewBoolVar(f"any_common_{level}_{d}_{h}")
                        model.Add(sum(commons_vars) >= 1).OnlyEnforceIf(any_common)
                        model.Add(sum(commons_vars) == 0).OnlyEnforceIf(any_common.Not())
                        model.Add(sum(others_vars) == 0).OnlyEnforceIf(any_common)

        apply_exclusion_constraints(
            model, assignments, req, durations, venues_work, days_map, num_hours
        )

        # Friday prayers 1pm–2pm → block starts that cover hour index 4 (13:00)
        for c in req.courses:
            dur = durations[c.id]
            for v in venues_work:
                for start in range(num_hours - dur + 1):
                    if start <= 4 < start + dur:
                        key = (c.id, v.id, 4, start)
                        if key in assignments:
                            model.Add(assignments[key] == 0)

        objective_terms = []
        for c in req.courses:
            objective_terms.append(is_scheduled[c.id] * 10000)

        # Prefer earlier days and morning slots (secondary, small weights)
        for key, var in assignments.items():
            _cid, _vid, d, h = key
            objective_terms.append(var * (5 - d))
            objective_terms.append(var * (8 - h))

        model.Maximize(sum(objective_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 45.0

        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            final_schedule = []
            conflicts = []

            for c in req.courses:
                if solver.Value(is_scheduled[c.id]) == 1:
                    for v in venues_work:
                        for d in range(num_days):
                            for h in range(num_hours - durations[c.id] + 1):
                                key = (c.id, v.id, d, h)
                                if key in assignments and solver.Value(assignments[key]) == 1:
                                    actual_start = 9 + h
                                    actual_end = actual_start + durations[c.id]
                                    final_schedule.append(
                                        {
                                            "id": f"slot_{c.id}",
                                            "courseId": c.id,
                                            "code": c.code,
                                            "title": c.title,
                                            "lecturer": c.lecturer,
                                            "students": c.students,
                                            "level": c.level,
                                            "courseType": c.type,
                                            "department": c.department,
                                            "assignedVenue": {
                                                "id": v.id,
                                                "name": v.name,
                                                "type": v.type,
                                            },
                                            "assignedDay": days_map[d],
                                            "assignedStart": actual_start,
                                            "assignedEnd": actual_end,
                                            "duration": f"{durations[c.id]}h",
                                            "durationParams": f"{durations[c.id]}h",
                                        }
                                    )
                else:
                    c_students = int(c.students) if c.students else 0
                    caps = []
                    for v in venues_work:
                        if is_online_venue(v) or not v.capacity:
                            continue
                        try:
                            caps.append(int(v.capacity))
                        except (TypeError, ValueError):
                            pass
                    max_cap = max(caps) if caps else 0

                    reason = "Could not place this course without breaking venue type, capacity, lecturer, cohort, or cross-department rules. "
                    if _course_delivery_family(c.type) != "online" and c_students > max_cap > 0:
                        reason += (
                            f"Enrollment ({c_students}) exceeds the largest compatible venue "
                            f"you selected (capacity {max_cap}). Consider online delivery or extra sections."
                        )
                    elif _course_delivery_family(c.type) == "computing_lab" and not any(
                        _venue_family(v) == "computer_lab" for v in venues_work
                    ):
                        reason += "No computer lab venues are available in your selected venue list."
                    elif _course_delivery_family(c.type) == "physics_lab" and not any(
                        _venue_family(v) == "physics_lab" for v in venues_work
                    ):
                        reason += "No physics lab is available in your selected venue list."
                    else:
                        reason += (
                            "Try widening time options, adding venues, relaxing exclusions, or reducing load "
                            "on the same level/lecturer."
                        )

                    conflicts.append({"code": c.code, "reason": reason})

            return {"schedule": final_schedule, "conflicts": conflicts}

        return {
            "schedule": [],
            "conflicts": [
                {
                    "code": "System",
                    "reason": "Solver found no feasible timetable under current hard constraints "
                    "(try fewer simultaneous exclusions or more compatible venues).",
                }
            ],
        }

    except Exception as e:
        print("Backend Error: ", str(e))
        raise HTTPException(status_code=500, detail=str(e))

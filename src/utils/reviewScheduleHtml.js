import { slotTimeRange, formatExamInvigilatorsCell } from './timetableExport';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function lectureLevelRank(level) {
    const n = parseInt(String(level || '').replace(/\D/g, ''), 10);
    if (Number.isFinite(n)) return n;
    return 999;
}

export function sortLectureForReview(rows) {
    return [...rows].sort((a, b) => {
        const la = lectureLevelRank(a.level);
        const lb = lectureLevelRank(b.level);
        if (la !== lb) return la - lb;
        const ia = DAY_ORDER.indexOf(a.assignedDay);
        const ib = DAY_ORDER.indexOf(b.assignedDay);
        if (ia !== ib) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return (a.assignedStart || 0) - (b.assignedStart || 0);
    });
}

export function sortExamForReview(rows) {
    return [...rows].sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        if (da !== db) return da - db;
        const la = lectureLevelRank(a.level);
        const lb = lectureLevelRank(b.level);
        if (la !== lb) return la - lb;
        return String(a.courseCode ?? '').localeCompare(String(b.courseCode ?? ''));
    });
}

/**
 * Builds a standalone HTML document for iframe srcDoc (full timetable audit view).
 */
export function buildReviewScheduleSrcDoc(kind, schedule, { department = '', semester = '' } = {}) {
    const rows = Array.isArray(schedule) ? schedule : [];

    let body = '';

    const headerStyle = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #f8fafc;
      padding: 16px 20px 32px;
    }
    .banner {
      background: linear-gradient(135deg,#00008b 0%, #1e1b4b 45%, #579044 100%);
      color: #fff;
      padding: 20px 24px;
      border-radius: 16px;
      margin-bottom: 16px;
    }
    .banner h1 { margin: 0 0 6px; font-size: 18px; font-weight: 900; letter-spacing: -0.02em;}
    .banner p { margin: 0; opacity: 0.9; font-size: 11px;}
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,.08);}
    thead th {
      background: #0f172a; color: #fff;
      padding: 10px 12px; text-align: left;
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    }
    tbody td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .num { text-align: center; white-space: nowrap; }
`;

    const metaParts = [];
    if (department) metaParts.push(`Department: ${department}`);
    if (semester) metaParts.push(`Semester: ${semester}`);
    const metaHtml = escapeHtml(metaParts.join(' · '));

    if (kind === 'exam') {
        const sorted = sortExamForReview(rows);
        const trs = sorted
            .map((ex, i) => {
                const inv = formatExamInvigilatorsCell(ex) || '—';
                const dateDisp = ex.date
                    ? new Date(ex.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                      })
                    : '';
                return `
        <tr>
          <td class="num">${escapeHtml(ex.level)}</td>
          <td>${escapeHtml(ex.courseCode)}</td>
          <td>${escapeHtml(ex.courseTitle)}</td>
          <td class="num">${escapeHtml(dateDisp)}</td>
          <td class="num">${escapeHtml(ex.session)}</td>
          <td class="num">${escapeHtml(ex.startTime)}</td>
          <td class="num">${escapeHtml(String(ex.durationMins ?? ''))}</td>
          <td>${escapeHtml(ex.venueName)}</td>
          <td style="font-size:11px;">${escapeHtml(inv)}</td>
        </tr>`;
            })
            .join('');

        body = `
<div class="banner">
  <h1>Submitted exam timetable · full review copy</h1>
  <p>${metaHtml} · ${rows.length} sitting(s)</p>
</div>
<table>
  <thead><tr>
    <th class="num">Level</th>
    <th>Code</th>
    <th>Course</th>
    <th class="num">Date</th>
    <th class="num">Session</th>
    <th class="num">Start</th>
    <th class="num">Mins</th>
    <th>Venue</th>
    <th>Invigilators</th>
  </tr></thead>
  <tbody>${trs || `<tr><td colspan="9" style="text-align:center;color:#64748b;">Empty</td></tr>`}</tbody>
</table>`;
    } else {
        const sorted = sortLectureForReview(rows);
        const trs = sorted
            .map((s) => {
                return `
        <tr>
          <td class="num">${escapeHtml(s.level ?? '')}</td>
          <td>${escapeHtml(s.code)}</td>
          <td>${escapeHtml(s.title)}</td>
          <td class="num">${escapeHtml(slotTimeRange(s))}</td>
          <td class="num">${escapeHtml(s.assignedDay)}</td>
          <td>${escapeHtml(s.assignedVenue?.name || s.assignedVenueName || '')}</td>
          <td>${escapeHtml(s.lecturer || 'TBA')}</td>
          <td class="num">${escapeHtml(String(s.duration ?? ''))}</td>
        </tr>`;
            })
            .join('');

        body = `
<div class="banner">
  <h1>Submitted lecture timetable · full review copy</h1>
  <p>${metaHtml} · ${rows.length} slot(s)</p>
</div>
<table>
  <thead><tr>
    <th class="num">Level</th>
    <th>Code</th>
    <th>Course</th>
    <th class="num">Time</th>
    <th class="num">Day</th>
    <th>Venue</th>
    <th>Lecturer</th>
    <th class="num">Hours</th>
  </tr></thead>
  <tbody>${trs || `<tr><td colspan="8" style="text-align:center;color:#64748b;">Empty</td></tr>`}</tbody>
</table>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Timetable review</title><style>${headerStyle}</style></head><body>${body}</body></html>`;
}

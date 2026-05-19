import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { normalizePersonTag, examInvigilatorNorms } from './timetableClashAnalysis';

function sanitizeExportStyles(el) {
    const style = window.getComputedStyle(el);
    ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke'].forEach((prop) => {
        const val = el.style[prop] || style[prop];
        if (val && (val.includes('oklch') || val.includes('oklab'))) {
            try {
                const dummy = document.createElement('div');
                dummy.style.color = val;
                document.body.appendChild(dummy);
                const rgbVal = window.getComputedStyle(dummy).color;
                document.body.removeChild(dummy);
                el.style[prop] = rgbVal;
            } catch {
                el.style[prop] = '#000000';
            }
        }
    });
    Array.from(el.children).forEach(sanitizeExportStyles);
}

function formatHourLabel(h) {
    const dur = typeof h === 'number' ? h : parseInt(String(h || ''), 10);
    if (Number.isNaN(dur) || dur < 0 || dur >= 24) return String(h ?? '');
    if (dur === 12) return '12PM';
    if (dur < 12) return `${dur}AM`;
    return `${dur - 12}PM`;
}

export function slotTimeRange(slot) {
    const start = typeof slot.assignedStart === 'number' ? slot.assignedStart : parseInt(slot.assignedStart, 10);
    const durationStr = slot.duration ?? '2h';
    const dur = typeof durationStr === 'number' ? durationStr : parseInt(String(durationStr), 10) || 2;
    const end = Number.isNaN(start) ? start : start + dur;
    if (slot.assignedEnd != null && !Number.isNaN(parseInt(slot.assignedEnd, 10))) {
        const ae = typeof slot.assignedEnd === 'number' ? slot.assignedEnd : parseInt(slot.assignedEnd, 10);
        return `${formatHourLabel(start)}–${formatHourLabel(ae)}`;
    }
    return `${formatHourLabel(start)}–${formatHourLabel(end)}`;
}

function filterScheduleByLevel(schedule, level) {
    if (!Array.isArray(schedule)) return [];
    if (level === 'All') return [...schedule];
    return schedule.filter((item) => {
        const lv = item.level != null ? String(item.level) : '';
        if (level === 'Other') return lv === '' || !['100', '200', '300', '400'].includes(lv);
        return lv === level;
    });
}

/**
 * Rows where slot.lecturer matches the staff member (deterministic normalized tag comparison).
 */
export function filterLectureScheduleByStaffNorm(schedule, staffNormOrLabel) {
    const n = normalizePersonTag(staffNormOrLabel);
    if (!n) return [];
    return (schedule || []).filter((s) => {
        const z = normalizePersonTag(s?.lecturer);
        return z && z === n;
    });
}

/**
 * Deduped lecturers on the timetable for coordinator staff pickers [{ norm, label }].
 */
export function collectLectureStaffOptions(schedule) {
    /** @type {Map<string,string>} */
    const map = new Map();
    for (const s of schedule || []) {
        const raw = String(s?.lecturer || '').trim();
        if (!raw || /^tba$/i.test(raw)) continue;
        const norm = normalizePersonTag(raw);
        if (!norm) continue;
        if (!map.has(norm)) map.set(norm, raw);
        else {
            const prev = map.get(norm);
            const preferCur = raw.length > (prev?.length || 0) && /\s/.test(raw);
            if (preferCur) map.set(norm, raw);
        }
    }
    return [...map.entries()]
        .map(([norm, label]) => ({ norm, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

/** True if this exam row concerns the staff member as invigilator or as course lecturer (blocked from invigilating). */
export function examRowConcernsStaffNorm(exam, staffNormOrLabel) {
    const n = normalizePersonTag(staffNormOrLabel);
    if (!n) return false;
    if (examInvigilatorNorms(exam).includes(n)) return true;
    const blk = exam?.invigilateBlockedNorms;
    if (Array.isArray(blk) && blk.some((x) => normalizePersonTag(x) === n)) return true;
    return false;
}

export function describeExamStaffRoles(exam, staffNormOrLabel) {
    const n = normalizePersonTag(staffNormOrLabel);
    const parts = [];
    if (!n) return '';
    if (examInvigilatorNorms(exam).includes(n)) parts.push('Invigilator');
    const blk = exam?.invigilateBlockedNorms;
    if (Array.isArray(blk) && blk.some((x) => normalizePersonTag(x) === n)) parts.push('Course lecturer');
    return parts.filter(Boolean).join(' · ');
}

export function filterExamScheduleByStaffNorm(schedule, staffNormOrLabel) {
    const n = normalizePersonTag(staffNormOrLabel);
    if (!n) return [];
    return (schedule || []).filter((ex) => examRowConcernsStaffNorm(ex, n));
}

/**
 * Union of everyone who appears as invigilator or as blocked teaching staff on any exam row.
 */
export function collectExamStaffOptions(schedule) {
    /** @type {Map<string,string>} */
    const map = new Map();
    const bump = (raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed || /^tba$/i.test(trimmed)) return;
        const norm = normalizePersonTag(trimmed);
        if (!norm) return;
        if (!map.has(norm)) map.set(norm, trimmed);
        else if (trimmed.length > map.get(norm).length && /\s/.test(trimmed)) map.set(norm, trimmed);
    };
    for (const ex of schedule || []) {
        const raw = ex?.invigilatorNames ?? ex?.invigilators;
        const arr = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[;,]/).map((x) => x.trim()) : [];
        for (const nm of arr) bump(nm);
        for (const b of ex.invigilateBlockedNorms || []) bump(b);
    }
    return [...map.entries()]
        .map(([norm, label]) => ({ norm, label }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

function buildLectureHtmlTable(schedule, { title, subtitle, omitLecturerColumn = false }) {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sorted = [...schedule].sort((a, b) => {
        if (a.assignedDay !== b.assignedDay) return dayOrder.indexOf(a.assignedDay) - dayOrder.indexOf(b.assignedDay);
        return (a.assignedStart || 0) - (b.assignedStart || 0);
    });

    const rows = sorted
        .map((course) => {
            const venue = course.assignedVenue?.name || course.assignedVenueName || '';
            const lecTd = omitLecturerColumn
                ? ''
                : `<td style="padding:8px;border:1px solid #e2e8f0;">${course.lecturer || 'TBA'}</td>`;
            return `<tr>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:800;">${course.code || ''}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#334155;">${(course.title || '').replace(/</g, '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:800;color:#4f46e5;">${slotTimeRange(course)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${course.assignedDay || ''}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${venue}</td>
        ${lecTd}
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:800;">${course.duration ?? ''}</td>
      </tr>`;
        })
        .join('');
    const headLec = omitLecturerColumn
        ? ''
        : '<th style="padding:10px;border:1px solid #1e293b;">Lecturer</th>';
    const eh = (s) => String(s ?? '').replace(/</g, '&lt;');
    const colspan = omitLecturerColumn ? 6 : 7;
    return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;background:#ffffff;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#020617;">${eh(title)}</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">${eh(subtitle)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;background:#ffffff;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-transform:uppercase;font-size:10px;">
            <th style="padding:10px;border:1px solid #1e293b;">Code</th>
            <th style="padding:10px;border:1px solid #1e293b;">Course</th>
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Time</th>
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Day</th>
            <th style="padding:10px;border:1px solid #1e293b;">Venue</th>
            ${headLec}
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Hours</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="${colspan}" style="padding:24px;text-align:center;color:#94a3b8;">No slots</td></tr>`}</tbody>
      </table>
    </div>`;
}

function buildExamHtmlTable(schedule, { title, subtitle, personalStaffNorm = null }) {
    const sorted = [...(schedule || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
    const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const nPersonal = normalizePersonTag(personalStaffNorm);
    const rows = sorted
        .map((exam) => {
            const dateStr = exam.date
                ? new Date(exam.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                  })
                : '';
            const roleCell = nPersonal ? esc(describeExamStaffRoles(exam, nPersonal)) : esc(formatExamInvigilatorsCell(exam) || '—');
            return `<tr>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:800;">${esc(exam.courseCode || '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#334155;">${esc(exam.courseTitle || '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${esc(exam.level != null ? exam.level : '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:700;">${esc(dateStr)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${esc(exam.session || '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;color:#4f46e5;font-weight:800;">${esc(exam.startTime || '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${esc(exam.durationMins ?? '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${esc(exam.venueName || '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px;max-width:220px;">${roleCell}</td>
      </tr>`;
        })
        .join('');
    const invHeader = nPersonal ? 'Role(s)' : 'Invigilators';
    return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;background:#ffffff;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#020617;">${esc(title)}</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">${esc(subtitle)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:11px;background:#ffffff;">
        <thead>
          <tr style="background:#1e1b4b;color:#ffffff;text-transform:uppercase;font-size:9px;">
            <th style="padding:10px;border:1px solid #312e81;">Code</th>
            <th style="padding:10px;border:1px solid #312e81;">Course</th>
            <th style="padding:10px;border:1px solid #312e81;text-align:center;">Level</th>
            <th style="padding:10px;border:1px solid #312e81;text-align:center;">Date</th>
            <th style="padding:10px;border:1px solid #312e81;text-align:center;">Session</th>
            <th style="padding:10px;border:1px solid #312e81;text-align:center;">Start</th>
            <th style="padding:10px;border:1px solid #312e81;text-align:center;">Mins</th>
            <th style="padding:10px;border:1px solid #312e81;">Venue</th>
            <th style="padding:10px;border:1px solid #312e81;">${invHeader}</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9" style="padding:24px;text-align:center;color:#94a3b8;">No exams</td></tr>'}</tbody>
      </table>
    </div>`;
}

async function htmlFragmentToPdfBlob(htmlContent, widthPx, windowWidth) {
    const wrap = document.createElement('div');
    wrap.innerHTML = htmlContent;
    wrap.style.position = 'fixed';
    wrap.style.left = '-9999px';
    wrap.style.top = '0';
    wrap.style.width = `${widthPx}px`;
    document.body.appendChild(wrap);
    try {
        const inner = wrap.firstElementChild;
        sanitizeExportStyles(inner);

        const canvas = await html2canvas(inner, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: windowWidth ?? widthPx,
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        return pdf.output('blob');
    } finally {
        document.body.removeChild(wrap);
    }
}

/** Try native share sheet with PDF; otherwise download then optional mailto. */
export async function shareDownloadOrMailPdf(blob, filename, lecturerEmail = '') {
    const file = new File([blob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, { type: 'application/pdf' });
    try {
        if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/i, '') });
            return;
        }
    } catch (e) {
        if (e?.name === 'AbortError') return;
    }

    triggerDownload(blob, file.name);

    const email = String(lecturerEmail || '').trim();
    const sub = encodeURIComponent(`Personal timetable (${file.name})`);
    const body = encodeURIComponent(
        `Dear colleague,\r\n\r\nPlease attach the timetable PDF (${file.name}) that was downloaded from FacultyAide to this email.\r\n\r\n(Some browsers cannot attach PDFs automatically from the webpage.)\r\n`,
    );

    let opened = false;
    if (email) {
        try {
            window.open(`mailto:${encodeURIComponent(email)}?subject=${sub}&body=${body}`, '_blank', 'noopener,noreferrer');
            opened = true;
        } catch {
            /* noop */
        }
    }
    if (!opened && email) {
        window.alert(
            `PDF saved as "${file.name}". We could not open your mail app automatically.\nCompose an email to ${email} and attach the file.`,
        );
    }
}

async function lectureSchedulePdfBlob(schedule, { department = '', filePrefix = 'Timetable', level = 'All', subtitle = '', staffNorm = '', staffDisplayLabel = '' }) {
    let filtered = filterScheduleByLevel(schedule || [], level);
    const staffN = normalizePersonTag(staffNorm);
    if (staffN) filtered = filterLectureScheduleByStaffNorm(filtered, staffN);

    if (!filtered.length) {
        return null;
    }

    const staffNote = staffN && staffDisplayLabel ? `Personal · ${staffDisplayLabel}` : '';
    let titleBase = `${filePrefix}${level !== 'All' ? ` (${level})` : ''}`;
    if (staffNote) titleBase = `${titleBase} · ${staffNote}`;
    const subParts = [];
    if (subtitle) subParts.push(subtitle);
    if (staffNote) subParts.push(`Contains only assignments for ${staffDisplayLabel || 'this lecturer'}`);
    subParts.push(department ? `${department} · FacultyAide` : 'FacultyAide');
    const sub = subParts.filter(Boolean).join(' · ');
    const html = buildLectureHtmlTable(filtered, { title: titleBase, subtitle: sub, omitLecturerColumn: !!staffN });
    const blob = await htmlFragmentToPdfBlob(html, 900, 900);

    const safeDept = String(department || 'dept').replace(/\s+/g, '-').slice(0, 28);
    const date = new Date().toISOString().slice(0, 10);
    const safeStaff =
        staffN && staffDisplayLabel
            ? `-${staffDisplayLabel.replace(/[^\w\u00C0-\u024F.-]+/gi, '-').replace(/-+/g, '-').slice(0, 36)}`
            : '';
    const fname = `${filePrefix}${safeStaff}-${safeDept}-${level}-${date}.pdf`.replace(/[^\w\u00C0-\u024F.+-]/g, '-');

    return { blob, filename: fname.endsWith('.pdf') ? fname : `${fname}.pdf` };
}

/**
 * Builds a temporal DOM subtree, snapshots with html2canvas, downloads PDF.
 * @param {object} opts
 * @param {string} [opts.staffNorm] normalized staff key → filter slots to this lecturer only
 */
export async function downloadLectureSchedulePdf(
    schedule,
    { department = '', filePrefix = 'Timetable', level = 'All', subtitle = '', staffNorm = '', staffDisplayLabel = '' } = {},
) {
    const built = await lectureSchedulePdfBlob(schedule, {
        department,
        filePrefix,
        level,
        subtitle,
        staffNorm,
        staffDisplayLabel,
    });
    if (!built) {
        window.alert(level === 'All' ? 'No schedule slots to export.' : `No slots for ${level}${staffNorm ? ' for this lecturer' : ''}.`);
        return;
    }
    triggerDownload(built.blob, built.filename);
}

export async function downloadLectureStaffPersonalPdfInteractive(
    schedule,
    opts = {},
) {
    const built = await lectureSchedulePdfBlob(schedule, opts);
    if (!built) {
        window.alert(opts.staffNorm ? 'No timetable rows for this lecturer at the chosen level.' : 'No schedule slots to export.');
        return;
    }
    await shareDownloadOrMailPdf(built.blob, built.filename, opts.lecturerEmail || '');
}

async function examSchedulePdfBlob(
    schedule,
    { department = '', filePrefix = 'Exam-Timetable', level = 'All', subtitle = '', staffNorm = '', staffDisplayLabel = '' },
) {
    let filtered = filterScheduleByLevel(schedule || [], level);
    const staffN = normalizePersonTag(staffNorm);
    if (staffN) filtered = filterExamScheduleByStaffNorm(filtered, staffN);

    if (!filtered.length) return null;

    const staffNote = staffN && staffDisplayLabel ? `Personal · ${staffDisplayLabel}` : '';
    let titleBase = `${filePrefix}${level !== 'All' ? ` (${level})` : ''}`;
    if (staffNote) titleBase = `${titleBase} · ${staffNote}`;
    const subParts = [];
    if (subtitle) subParts.push(subtitle);
    if (staffN)
        subParts.push(
            `Invigilator / teaching duties only for ${staffDisplayLabel || 'this staff member'}`,
        );
    subParts.push(department ? `${department} · Exams · FacultyAide` : 'Exams · FacultyAide');
    const sub = subParts.filter(Boolean).join(' · ');
    const html = buildExamHtmlTable(filtered, {
        title: titleBase.replace(/</g, '&lt;'),
        subtitle: sub,
        personalStaffNorm: staffN || null,
    });
    const blob = await htmlFragmentToPdfBlob(html, 1000, 1000);

    const safeDept = String(department || 'dept').replace(/\s+/g, '-').slice(0, 28);
    const date = new Date().toISOString().slice(0, 10);
    const safeStaff =
        staffN && staffDisplayLabel
            ? `-${staffDisplayLabel.replace(/[^\w\u00C0-\u024F.-]+/gi, '-').replace(/-+/g, '-').slice(0, 36)}`
            : '';
    let fname = `${filePrefix}${safeStaff}-${safeDept}-${level}-${date}.pdf`;

    fname = fname.replace(/[^\w\u00C0-\u024F.+-]/g, '-');
    return { blob, filename: fname.endsWith('.pdf') ? fname : `${fname}.pdf` };
}

/**
 * PDF export for coordinator exam timetable rows (same shape as ExamTimetable schedule items).
 * Pass staffNorm (+ staffDisplayLabel) for a staff-only personalised PDF.
 */
export async function downloadExamSchedulePdf(
    schedule,
    { department = '', filePrefix = 'Exam-Timetable', level = 'All', subtitle = '', staffNorm = '', staffDisplayLabel = '' } = {},
) {
    const built = await examSchedulePdfBlob(schedule, {
        department,
        filePrefix,
        level,
        subtitle,
        staffNorm,
        staffDisplayLabel,
    });
    if (!built) {
        window.alert(level === 'All' ? 'No exam rows to export.' : `No exams for ${level} level${staffNorm ? ' for this staff member' : ''}.`);
        return;
    }
    triggerDownload(built.blob, built.filename);
}

export async function downloadExamStaffPersonalPdfInteractive(schedule, opts = {}) {
    const built = await examSchedulePdfBlob(schedule, opts);
    if (!built) {
        window.alert(
            opts.staffNorm ? 'No exam rows for this staff member at the chosen level.' : 'No exam rows to export.',
        );
        return;
    }
    await shareDownloadOrMailPdf(built.blob, built.filename, opts.lecturerEmail || '');
}

export function downloadScheduleJson(schedule, { department = '', name = 'timetable' } = {}) {
    const payload = {
        exportedAt: new Date().toISOString(),
        department,
        slots: schedule || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${name}-${department?.replace(/\s+/g, '-') || 'export'}.json`);
}

export function downloadScheduleCsv(schedule, { department = '', name = 'timetable' } = {}) {
    const rows = Array.isArray(schedule) ? schedule : [];
    const header = ['code', 'title', 'level', 'day', 'timeRange', 'venue', 'lecturer', 'durationHours'];
    const lines = [
        header.join(','),
        ...rows.map((s) =>
            header
                .map((col) => {
                    let cell = '';
                    if (col === 'day') cell = s.assignedDay || '';
                    else if (col === 'timeRange') cell = slotTimeRange(s);
                    else if (col === 'venue') cell = s.assignedVenue?.name || s.assignedVenueName || '';
                    else if (col === 'lecturer') cell = s.lecturer || '';
                    else if (col === 'durationHours') cell = s.duration ?? '';
                    else cell = (s[col] ?? '').toString();
                    cell = cell.replace(/"/g, '""');
                    if (/[",\n]/.test(cell)) return `"${cell}"`;
                    return cell;
                })
                .join(','),
        ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${name}-${(department || 'export').replace(/\s+/g, '-')}.csv`);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Semicolon-separated invigilator names for CSV/PDF; empty if none assigned. */
export function formatExamInvigilatorsCell(ex) {
    const raw = ex?.invigilatorNames ?? ex?.invigilators;
    if (Array.isArray(raw) && raw.length) return raw.filter(Boolean).join('; ');
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return '';
}

export function downloadExamScheduleJson(schedule, { department = '', name = 'exam-timetable' } = {}) {
    const payload = {
        exportedAt: new Date().toISOString(),
        department,
        kind: 'exam',
        exams: schedule || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${name}-${department?.replace(/\s+/g, '-') || 'export'}.json`);
}

export function downloadExamScheduleCsv(schedule, { department = '', name = 'exam-timetable' } = {}) {
    const rows = Array.isArray(schedule) ? schedule : [];
    const header = [
        'courseCode',
        'courseTitle',
        'level',
        'date',
        'session',
        'startTime',
        'durationMins',
        'venueName',
        'venueCapacity',
        'invigilators',
    ];
    const lines = [
        header.join(','),
        ...rows.map((ex) =>
            header
                .map((col) => {
                    let cell = '';
                    if (col === 'invigilators') cell = formatExamInvigilatorsCell(ex);
                    else cell = (ex[col] ?? '').toString();
                    cell = cell.replace(/"/g, '""');
                    if (/[",\n]/.test(cell)) return `"${cell}"`;
                    return cell;
                })
                .join(','),
        ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, `${name}-${(department || 'export').replace(/\s+/g, '-')}.csv`);
}

export {
    filterScheduleByLevel,
    formatHourLabel,
};

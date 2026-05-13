import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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

function slotTimeRange(slot) {
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

function buildLectureHtmlTable(schedule, { title, subtitle }) {
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const sorted = [...schedule].sort((a, b) => {
        if (a.assignedDay !== b.assignedDay) return dayOrder.indexOf(a.assignedDay) - dayOrder.indexOf(b.assignedDay);
        return (a.assignedStart || 0) - (b.assignedStart || 0);
    });
    const rows = sorted
        .map((course) => {
            const venue = course.assignedVenue?.name || course.assignedVenueName || '';
            return `<tr>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:800;">${course.code || ''}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#334155;">${(course.title || '').replace(/</g, '')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:800;color:#4f46e5;">${slotTimeRange(course)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;">${course.assignedDay || ''}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${venue}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;">${course.lecturer || 'TBA'}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-weight:800;">${course.duration ?? ''}</td>
      </tr>`;
        })
        .join('');
    return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;background:#ffffff;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:20px;color:#020617;">${title}</h1>
      <p style="margin:0 0 16px;color:#64748b;font-size:13px;">${subtitle}</p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;background:#ffffff;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;text-transform:uppercase;font-size:10px;">
            <th style="padding:10px;border:1px solid #1e293b;">Code</th>
            <th style="padding:10px;border:1px solid #1e293b;">Course</th>
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Time</th>
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Day</th>
            <th style="padding:10px;border:1px solid #1e293b;">Venue</th>
            <th style="padding:10px;border:1px solid #1e293b;">Lecturer</th>
            <th style="padding:10px;border:1px solid #1e293b;text-align:center;">Hours</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="7" style="padding:24px;text-align:center;color:#94a3b8;">No slots</td></tr>'}</tbody>
      </table>
    </div>`;
}

/**
 * Builds a temporal DOM subtree, snapshots with html2canvas, downloads PDF.
 */
export async function downloadLectureSchedulePdf(schedule, { department = '', filePrefix = 'Timetable', level = 'All', subtitle = '' } = {}) {
    const filtered = filterScheduleByLevel(schedule || [], level);
    if (!filtered.length) {
        window.alert(level === 'All' ? 'No schedule slots to export.' : `No slots for ${level}.`);
        return;
    }

    const title = `${filePrefix}${level !== 'All' ? ` (${level})` : ''}`;
    const sub = subtitle || `${department || 'Department'} · FacultyAide`;

    const wrap = document.createElement('div');
    wrap.innerHTML = buildLectureHtmlTable(filtered, { title, subtitle: sub });
    wrap.style.position = 'fixed';
    wrap.style.left = '-9999px';
    wrap.style.top = '0';
    wrap.style.width = '900px';
    document.body.appendChild(wrap);

    try {
        const inner = wrap.firstElementChild;
        sanitizeExportStyles(inner);

        const canvas = await html2canvas(inner, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
        const safeDept = String(department || 'dept').replace(/\s+/g, '-').slice(0, 28);
        const date = new Date().toISOString().slice(0, 10);
        pdf.save(`${filePrefix}-${safeDept}-${level}-${date}.pdf`);
    } finally {
        document.body.removeChild(wrap);
    }
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
                .join(',')
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

export { filterScheduleByLevel, slotTimeRange, formatHourLabel };

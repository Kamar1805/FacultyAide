import React, { useEffect, useState } from 'react';
import { MessageSquare, X, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

/**
 * Centered modal for an optional message when submitting a timetable to admins.
 * Primary sends `note` (may be empty — parent applies default body).
 * Cancel closes without calling onSend.
 */
export default function OptionalNoteToAdminsModal({
    open,
    onClose,
    onSend,
    pending = false,
    title = 'Message to administrators',
    description = 'Add context for the review team, or leave blank to use a standard submission message.',
}) {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (open) setNote('');
    }, [open]);

    if (!open) return null;

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget && !pending) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdrop}
            role="presentation"
        >
            <div
                className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl shadow-slate-900/20 border border-slate-200/80 ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200"
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-note-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    disabled={pending}
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
                    aria-label="Close"
                >
                    <X size={20} />
                </button>

                <div className="p-6 sm:p-8 pt-10 sm:pt-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00008b]/10 text-[#00008b]">
                            <MessageSquare size={22} strokeWidth={2.25} />
                        </div>
                        <h2 id="admin-note-modal-title" className="text-lg sm:text-xl font-black text-slate-900 tracking-tight pr-10">
                            {title}
                        </h2>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mt-3 mb-5">{description}</p>

                    <label htmlFor="admin-note-textarea" className="sr-only">
                        Optional note
                    </label>
                    <textarea
                        id="admin-note-textarea"
                        rows={4}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={pending}
                        placeholder="e.g. Please prioritise clash checks between us and Mechanical before sign-off…"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00008b]/25 focus:border-[#00008b]/40 resize-y min-h-[6rem] disabled:opacity-60"
                    />
                    <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                        <strong className="text-slate-700">Leave empty</strong> to attach the draft with a generic message.{' '}
                        <strong className="text-slate-700">Cancel</strong> stops sending.
                    </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 sm:px-8 pb-6 sm:pb-8 pt-0 sm:gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        className="w-full sm:w-auto rounded-xl font-bold border-slate-200"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={pending}
                        className="w-full sm:w-auto rounded-xl font-bold bg-[#00008b] hover:bg-[#000060] text-white shadow-lg shadow-indigo-900/10"
                        onClick={() => onSend(note)}
                    >
                        {pending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending…
                            </>
                        ) : (
                            <>
                                Send to admins
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

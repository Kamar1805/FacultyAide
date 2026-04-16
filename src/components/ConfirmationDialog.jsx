import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

const ConfirmationDialog = ({ isOpen, title, description, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", ...props }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-200 border border-slate-100 ring-1 ring-slate-900/5"
                role="dialog"
                aria-modal="true"
            >
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-rose-100 sm:w-10 sm:h-10">
                            <AlertTriangle className="w-6 h-6 text-rose-600" aria-hidden="true" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                            <h3 className="text-lg font-bold leading-6 text-slate-900" id="modal-title">
                                {title}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-500">
                                    {description}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 border-t border-slate-100">
                    <Button
                        onClick={onConfirm}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold w-full sm:w-auto shadow-sm shadow-rose-200"
                    >
                        {confirmText}
                    </Button>
                    <Button
                        onClick={onCancel}
                        variant="outline"
                        className="bg-white text-slate-700 border-slate-300 hover:bg-slate-50 font-semibold w-full sm:w-auto"
                    >
                        {cancelText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationDialog;

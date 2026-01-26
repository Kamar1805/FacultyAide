import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const InstructionGuide = ({ title = "How to use this page", steps = [] }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    if (!isVisible) return null;

    return (
        <div className="mb-6 border border-blue-100 bg-blue-50/50 rounded-lg overflow-hidden shadow-sm">
            <div
                className="flex items-center justify-between p-3 cursor-pointer bg-blue-50 hover:bg-blue-100/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Info size={18} />
                    <span>{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsVisible(false); }}
                        className="text-slate-400 hover:text-slate-600 p-1 hover:bg-blue-100 rounded"
                    >
                        <X size={16} />
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-primary" /> : <ChevronDown size={16} className="text-primary" />}
                </div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="p-4 pt-0 text-sm text-slate-600 space-y-2 border-t border-blue-100/50">
                            <ul className="list-disc pl-5 space-y-1 mt-3">
                                {steps.map((step, index) => (
                                    <li key={index} className="leading-relaxed">{step}</li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InstructionGuide;

import React from 'react';
import { motion } from 'framer-motion';
import { Users, MapPin, Calendar, CheckCircle } from 'lucide-react';

const stats = [
    { label: 'Total Exams', value: '24', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-100/50' },
    { label: 'Total Students', value: '1,450', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100/50' },
    { label: 'Venues Used', value: '12', icon: MapPin, color: 'text-amber-600', bg: 'bg-amber-100/50' },
    { label: 'Verified', value: '18', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-100/50' },
];

const TimetableSummary = () => {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-4 rounded-2xl border border-white/20 bg-white/40 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all group overflow-hidden relative"
                >
                    <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${stat.bg} blur-2xl group-hover:scale-150 transition-transform duration-500`} />
                    <div className="relative flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${stat.bg}`}>
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                        </div>
                        <div>
                            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                            <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default TimetableSummary;

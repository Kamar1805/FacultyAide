import React, { useState } from 'react';
import { cn } from '../lib/utils';


// Mock grid generator
const generateSeats = (rows, cols) => {
    const seats = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            // Randomly assign students vs empty
            const hasStudent = Math.random() > 0.3;
            seats.push({
                id: `${r}-${c}`,
                row: r + 1,
                col: c + 1,
                studentName: hasStudent ? `Student ${r * cols + c}` : null,
                status: hasStudent ? 'present' : 'empty', // default present for demo
                regNo: hasStudent ? `CSC/20/${1000 + r * cols + c}` : null
            });
        }
    }
    return seats;
};

const HallMap = ({ venueId = "E125", rows = 6, cols = 12 }) => {
    const [seats, setSeats] = useState(generateSeats(rows, cols));

    const toggleAttendance = (id) => {
        setSeats(seats.map(s => {
            if (s.id === id && s.studentName) {
                return { ...s, status: s.status === 'present' ? 'absent' : 'present' };
            }
            return s;
        }));
    };

    return (
        <div className="overflow-x-auto pb-4">
            <div
                className="grid gap-2 mx-auto"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(40px, 1fr))`,
                    width: 'fit-content'
                }}
            >
                {seats.map((seat) => (
                    <div
                        key={seat.id}
                        onClick={() => toggleAttendance(seat.id)}
                        title={seat.studentName ? `${seat.studentName} (${seat.regNo})` : 'Empty Seat'}
                        className={cn(
                            "w-10 h-10 rounded-md flex items-center justify-center text-xs font-bold cursor-pointer transition-all shadow-sm border",
                            !seat.studentName && "bg-slate-100 border-slate-200 text-slate-300",
                            seat.studentName && seat.status === 'present' && "bg-green-100 border-green-300 text-green-700 hover:bg-green-200",
                            seat.studentName && seat.status === 'absent' && "bg-red-100 border-red-300 text-red-700 hover:bg-red-200"
                        )}
                    >
                        {seat.studentName ? (
                            seat.status === 'present' ? 'P' : 'A'
                        ) : (
                            '•'
                        )}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
                    <span className="text-sm text-slate-600">Present</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
                    <span className="text-sm text-slate-600">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-100 border border-slate-200 rounded"></div>
                    <span className="text-sm text-slate-600">Empty</span>
                </div>
            </div>
        </div>
    );
};

export default HallMap;

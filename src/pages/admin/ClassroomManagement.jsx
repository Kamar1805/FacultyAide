import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BadgeCheck, OctagonAlert, Hammer } from 'lucide-react';
import { cn } from '../../lib/utils';
import InstructionGuide from '../../components/InstructionGuide';

const initialVenues = [
    { id: 'v1', name: 'E020', capacity: 80, status: 'available' },
    { id: 'v2', name: 'E125', capacity: 120, status: 'maintenance' },
    { id: 'v3', name: 'Lab D207', capacity: 40, status: 'occupied' },
    { id: 'v4', name: 'LT5', capacity: 60, status: 'available' },
];

const ClassroomManagement = () => {
    const [venues, setVenues] = useState(initialVenues);
    const [isAdding, setIsAdding] = useState(false);
    const [newVenue, setNewVenue] = useState({ name: '', capacity: '', type: 'Hall' });

    const handleAddVenue = () => {
        if (!newVenue.name || !newVenue.capacity) return;
        setVenues([...venues, {
            id: `v${Date.now()}`,
            ...newVenue,
            status: 'available',
            capacity: parseInt(newVenue.capacity)
        }]);
        setNewVenue({ name: '', capacity: '', type: 'Hall' });
        setIsAdding(false);
    };

    const toggleMaintenance = (id) => {
        setVenues(venues.map(v => {
            if (v.id === id) {
                return {
                    ...v,
                    status: v.status === 'maintenance' ? 'available' : 'maintenance'
                };
            }
            return v;
        }));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-green-100 text-green-700 border-green-200';
            case 'maintenance': return 'bg-slate-100 text-slate-600 border-slate-200 opacity-70';
            case 'occupied': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Classroom Management"
                steps={[
                    "View and manage the status of all teaching venues.",
                    "Toggle venue status (Available/Maintenance) to update global availability.",
                    "Check venue features and capacity limits."
                ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Classroom Management</h2>
                    <p className="text-slate-500 text-sm">Manage physical venues and facilities.</p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => setIsAdding(true)} className="bg-primary hover:bg-primary/90 shadow-lg shadow-blue-900/20 w-full sm:w-auto">
                        + Add New Venue
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => setIsAdding(false)} className="w-full sm:w-auto">
                        Cancel
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border-2 border-primary/20 bg-blue-50/50 animate-in slide-in-from-top-2">
                    <CardHeader>
                        <CardTitle className="text-lg text-primary">Add New Venue</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Venue Name</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g. E101"
                                    value={newVenue.name}
                                    onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Capacity</label>
                                <input
                                    type="number"
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="e.g. 150"
                                    value={newVenue.capacity}
                                    onChange={(e) => setNewVenue({ ...newVenue, capacity: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-1 block">Type</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    value={newVenue.type}
                                    onChange={(e) => setNewVenue({ ...newVenue, type: e.target.value })}
                                >
                                    <option value="Hall">Lecture Hall</option>
                                    <option value="Lab">Laboratory</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button onClick={handleAddVenue} className="bg-primary">Save Venue</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {venues.map((venue) => (
                    <Card key={venue.id} className={cn(
                        "transition-all duration-300 group hover:shadow-lg border-slate-200",
                        venue.status === 'maintenance' ? "bg-slate-50/80 border-slate-200" : "bg-white"
                    )}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg",
                                    venue.status === 'available' ? "bg-green-100 text-green-700" :
                                        venue.status === 'occupied' ? "bg-amber-100 text-amber-700" :
                                            "bg-slate-200 text-slate-600"
                                )}>
                                    {venue.name.charAt(0)}
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-slate-900">{venue.name}</CardTitle>
                                    <p className="text-xs text-slate-500 font-medium">Block A • Floor 2</p>
                                </div>
                            </div>
                            <div className={cn("px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border", getStatusColor(venue.status))}>
                                {venue.status}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0">
                            <div className="flex items-center justify-between mt-4 mb-6">
                                <div className="text-center w-1/3 border-r border-slate-100 last:border-0">
                                    <span className="block text-xl font-bold text-slate-800">{venue.capacity}</span>
                                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Seats</span>
                                </div>
                                <div className="text-center w-1/3 border-r border-slate-100 last:border-0">
                                    <span className="block text-xl font-bold text-slate-800">Yes</span>
                                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Projector</span>
                                </div>
                                <div className="text-center w-1/3">
                                    <span className="block text-xl font-bold text-slate-800">Ok</span>
                                    <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">AC Status</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1 hover:bg-slate-50 hover:text-primary transition-colors">Details</Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "flex-1 border",
                                        venue.status === 'maintenance'
                                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                    )}
                                    onClick={() => toggleMaintenance(venue.id)}
                                >
                                    {venue.status === 'maintenance' ? (
                                        <>
                                            <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Ready
                                        </>
                                    ) : (
                                        <>
                                            <Hammer className="mr-2 h-3.5 w-3.5" /> Fix
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default ClassroomManagement;

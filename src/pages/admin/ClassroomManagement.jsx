import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { BadgeCheck, Hammer, Layers, Trash2, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import InstructionGuide from '../../components/InstructionGuide';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, updateDoc, doc, query, orderBy, deleteDoc } from 'firebase/firestore';

const ClassroomManagement = () => {
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    // Fetch Venues from Firebase
    useEffect(() => {
        const q = query(collection(db, 'venues'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const venueList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setVenues(venueList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const [newVenue, setNewVenue] = useState({ name: '', capacity: '', type: 'Hall', dept: 'General', maintenance: false });

    // Populate form for editing
    const handleEditClick = (venue) => {
        setNewVenue({
            name: venue.name,
            capacity: venue.capacity,
            type: venue.type,
            dept: venue.dept,
            maintenance: venue.status === 'maintenance'
        });
        setEditId(venue.id);
        setIsEditing(true);
        setIsAdding(true); // Re-use the adding UI form
    };

    const handleSaveVenue = async () => {
        if (!newVenue.name || !newVenue.capacity) return;

        try {
            if (isEditing && editId) {
                // UPDATE Logic
                await updateDoc(doc(db, 'venues', editId), {
                    name: newVenue.name,
                    capacity: parseInt(newVenue.capacity),
                    type: newVenue.type,
                    dept: newVenue.dept,
                    status: newVenue.maintenance ? 'maintenance' : 'available',
                    updatedAt: new Date().toISOString()
                });
                alert("Venue updated successfully!");
            } else {
                // CREATE Logic
                await addDoc(collection(db, 'venues'), {
                    name: newVenue.name,
                    capacity: parseInt(newVenue.capacity),
                    type: newVenue.type,
                    dept: newVenue.dept,
                    status: newVenue.maintenance ? 'maintenance' : 'available',
                    createdAt: new Date().toISOString()
                });
            }

            // Reset Form and State
            setNewVenue({ name: '', capacity: '', type: 'Hall', dept: 'General', maintenance: false });
            setIsAdding(false);
            setIsEditing(false);
            setEditId(null);
        } catch (error) {
            console.error("Error saving venue:", error);
            alert("Failed to save venue. Please try again.");
        }
    };

    const toggleMaintenance = async (venue) => {
        const newStatus = venue.status === 'maintenance' ? 'available' : 'maintenance';
        try {
            await updateDoc(doc(db, 'venues', venue.id), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating venue:", error);
        }
    };

    const handleDeleteVenue = async (id) => {
        if (window.confirm("Are you sure you want to permanently delete this venue?")) {
            try {
                await deleteDoc(doc(db, 'venues', id));
            } catch (error) {
                console.error("Error deleting venue:", error);
            }
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'maintenance': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'occupied': return 'bg-slate-100 text-slate-600 border-slate-200';
            default: return 'bg-slate-100';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="Hall Management"
                steps={[
                    "Catalog all teaching venues and laboratories.",
                    "Map venues to specific departments for priority allocation.",
                    "Use 'Edit' to modify capacity or assignment.",
                    "Use 'Maintenance Mode' to temporarily disable venues from the scheduling engine."
                ]}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">Hall Management</h2>
                    <p className="text-slate-500 text-sm">Configure physical infrastructure and availability.</p>
                </div>
                {!isAdding ? (
                    <Button onClick={() => { setIsAdding(true); setIsEditing(false); setNewVenue({ name: '', capacity: '', type: 'Hall', dept: 'General', maintenance: false }); }} className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20 w-full sm:w-auto">
                        + Add New Hall
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => { setIsAdding(false); setIsEditing(false); setEditId(null); }} className="w-full sm:w-auto">
                        Cancel Note
                    </Button>
                )}
            </div>

            {isAdding && (
                <Card className="border border-slate-200 bg-white shadow-sm animate-in slide-in-from-top-2">
                    <CardHeader className="pb-4 border-b border-slate-100">
                        <CardTitle className="text-lg font-bold text-slate-800">
                            {isEditing ? "Edit Venue Details" : "New Venue Details"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Hall Name</label>
                                <input
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                    placeholder="e.g. Lecture Theater 1"
                                    value={newVenue.name}
                                    onChange={(e) => setNewVenue({ ...newVenue, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Capacity</label>
                                <input
                                    type="number"
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                    placeholder="e.g. 150"
                                    value={newVenue.capacity}
                                    onChange={(e) => setNewVenue({ ...newVenue, capacity: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Allocated Dept.</label>
                                <select
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                    value={newVenue.dept}
                                    onChange={(e) => setNewVenue({ ...newVenue, dept: e.target.value })}
                                >
                                    <option value="General">General Pool</option>
                                    <option value="Computer Science">Computer Science</option>
                                    <option value="Software Engineering">Software Engineering</option>
                                    <option value="Cyber Security">Cyber Security</option>
                                    <option value="Information Systems">Information Systems</option>
                                    <option value="Information Technology">Information Technology</option>
                                    <option value="Data Science">Data Science</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Venue Type</label>
                                <select
                                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
                                    value={newVenue.type}
                                    onChange={(e) => setNewVenue({ ...newVenue, type: e.target.value })}
                                >
                                    <option value="Hall">Lecture Hall</option>
                                    <option value="Lab">Computer Lab</option>
                                    <option value="Studio">Studio</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-100">
                            <input
                                type="checkbox"
                                id="maintenanceMode"
                                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                checked={newVenue.maintenance}
                                onChange={(e) => setNewVenue({ ...newVenue, maintenance: e.target.checked })}
                            />
                            <label htmlFor="maintenanceMode" className="text-sm font-bold text-amber-900 cursor-pointer select-none">
                                Enable Maintenance Mode (Immediately marks as unavailable)
                            </label>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button onClick={handleSaveVenue} className={`hover:bg-indigo-700 text-white font-bold px-6 ${isEditing ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600'}`}>
                                {isEditing ? "Update Venue" : "Save Venue"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {loading ? (
                <div className="text-center py-20 bg-white rounded-xl border border-slate-100">
                    <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Loading halls...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {venues.map((venue) => (
                        <Card key={venue.id} className={cn(
                            "transition-all duration-300 group hover:shadow-lg border-slate-200 overflow-hidden relative",
                            venue.status === 'maintenance' ? "bg-slate-50/80" : "bg-white"
                        )}>
                            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEditClick(venue)}
                                    className="text-slate-300 hover:text-indigo-500 transition-colors"
                                    title="Edit"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteVenue(venue.id)}
                                    className="text-slate-300 hover:text-red-500 transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 p-5 border-b border-slate-50">
                                <div className="pr-4">
                                    <CardTitle className="text-lg font-bold text-slate-900">{venue.name}</CardTitle>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">{venue.type}</span>
                                        {venue.dept !== 'General' && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 truncate max-w-[120px]">
                                                {venue.dept}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={cn("px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border", getStatusColor(venue.status))}>
                                    {venue.status}
                                </div>
                            </CardHeader>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <span className="block text-3xl font-black text-slate-800">{venue.capacity}</span>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Capacity</span>
                                    </div>
                                    <div className="h-10 w-10 text-slate-300">
                                        <Layers size={40} strokeWidth={1} />
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "w-full border font-bold text-xs uppercase tracking-wide",
                                        venue.status === 'maintenance'
                                            ? "bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                                    )}
                                    onClick={() => toggleMaintenance(venue)}
                                >
                                    {venue.status === 'maintenance' ? (
                                        <>
                                            <BadgeCheck className="mr-2 h-3.5 w-3.5" /> Mark Active
                                        </>
                                    ) : (
                                        <>
                                            <Hammer className="mr-2 h-3.5 w-3.5" /> Maintenance
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                    {venues.length === 0 && (
                        <div className="col-span-full text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500 font-medium">No halls cataloged.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClassroomManagement;

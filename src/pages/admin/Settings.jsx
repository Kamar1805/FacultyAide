import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { User, Bell, Shield, Moon } from 'lucide-react';
import InstructionGuide from '../../components/InstructionGuide';

const Settings = () => {
    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
            <InstructionGuide
                title="System Settings"
                steps={[
                    "Update your admin profile information and email.",
                    "Configure system-wide notification preferences.",
                    "Manage security settings including password updates."
                ]}
            />
            <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
                <p className="text-slate-500 text-sm">Manage your account preferences and system configuration.</p>
            </div>

            <div className="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Profile Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Full Name</label>
                            <input type="text" defaultValue="Dr. Amina" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                        </div>
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Email Address</label>
                            <input type="email" defaultValue="admin@faculty.edu" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="text-sm font-medium">Email Notifications</div>
                                <div className="text-xs text-slate-500">Receive emails about system updates.</div>
                            </div>
                            <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer"><div className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div></div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="text-sm font-medium">SMS Alerts</div>
                                <div className="text-xs text-slate-500">Get text messages for critical alerts.</div>
                            </div>
                            <div className="h-6 w-11 rounded-full bg-slate-200 relative cursor-pointer"><div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm"></div></div>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-4">
                    <Button variant="ghost">Cancel</Button>
                    <Button className="bg-primary">Save Changes</Button>
                </div>
            </div>
        </div>
    );
};

export default Settings;

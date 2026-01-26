import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Auth from './pages/Auth';

import LandingPage from './pages/LandingPage';
import AdminLayout from './layouts/AdminLayout';
import DashboardOverview from './pages/admin/DashboardOverview';
import ClassroomManagement from './pages/admin/ClassroomManagement';
import Courses from './pages/admin/Courses';
import TimetableGenerator from './pages/admin/TimetableGenerator';
import InvigilatorDashboard from './pages/invigilator/InvigilatorDashboard';
import ExamTimetable from './pages/admin/ExamTimetable';
import Settings from './pages/admin/Settings';
import StudentDashboard from './pages/student/StudentDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-background text-primary">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Auth />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="classrooms" element={<ClassroomManagement />} />
            <Route path="courses" element={<Courses />} />
            <Route path="exams" element={<ExamTimetable />} />
            <Route path="timetable" element={<TimetableGenerator />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Invigilator Routes */}
          <Route path="/invigilator" element={<InvigilatorDashboard />} />

          {/* Student Routes */}
          <Route path="/student" element={<StudentDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

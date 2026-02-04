import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Auth from './pages/Auth';
import LandingPage from './pages/LandingPage';

// Admin Pages
import AdminLayout from './layouts/AdminLayout';
import DashboardOverview from './pages/admin/DashboardOverview';
import ClassroomManagement from './pages/admin/ClassroomManagement';
import Courses from './pages/admin/Courses';
import LecturerManagement from './pages/admin/LecturerManagement';

// Coordinator Pages
import CoordinatorLayout from './layouts/CoordinatorLayout';
import CoordinatorDashboard from './pages/coordinator/DashboardOverview';
import LectureTimetable from './pages/coordinator/LectureTimetable';
import ExamTimetable from './pages/coordinator/ExamTimetable';
import ConstraintSettings from './pages/coordinator/ConstraintSettings';
import CourseManager from './pages/coordinator/CourseManager';

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
            <Route path="lecturers" element={<LecturerManagement />} />
            <Route path="courses" element={<Courses />} />
            {/* Redirect old routes or handle 404 if needed, for now we just have these */}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>

          <Route path="/coordinator" element={<CoordinatorLayout />}>
            <Route index element={<CoordinatorDashboard />} />
            <Route path="lecture-timetable" element={<LectureTimetable />} />
            <Route path="courses" element={<CourseManager />} />
            <Route path="exam-timetable" element={<ExamTimetable />} />
            <Route path="constraints" element={<ConstraintSettings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

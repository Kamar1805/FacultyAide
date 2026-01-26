import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Mock Implementation for Demo
// In production, you would fetch from Firestore

export const getVenues = async () => {
    // Placeholder: returning mock data
    return [
        { id: 'v1', name: 'E020', capacity: 80, status: 'available' },
        { id: 'v2', name: 'E125', capacity: 120, status: 'maintenance' },
        { id: 'v3', name: 'Lab D207', capacity: 40, status: 'occupied' },
        { id: 'v4', name: 'LT5', capacity: 60, status: 'available' },
    ];
};

export const getCourses = async () => {
    return [
        { code: 'CSC301', title: 'Data Structures', students: 245 },
        { code: 'SEN201', title: 'Intro to Software Eng', students: 180 },
    ];
};

// ... other service functions

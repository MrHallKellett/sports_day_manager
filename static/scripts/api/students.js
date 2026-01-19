// static/scripts/api/students.js
import { apiClient } from './api_client.js';

export async function fetchStudentsForSportsDay(sportsdayId) {
    const res = await apiClient(`/sportsdays/${sportsdayId}/students`);
    if (!res.ok) throw new Error("Failed to load students");
    return res.json();
}

export async function uploadStudentsCsv(sportsdayId, file) {
    const form = new FormData();
    form.append("file", file);

    return apiClient(
        `/sportsdays/${sportsdayId}/students/upload`,
        { method: "POST", body: form }
    );
}

/* ✅ NEW */

export async function updateStudent(studentId, payload) {
    return apiClient(`/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

export async function createStudent(payload) {
    return apiClient(`/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

export async function removeStudentFromSportsDay(sportsdayId, studentId) {
    const res = await apiClient(`/sportsdays/${sportsdayId}/students/${studentId}`, {
        method: "DELETE"
    });
    if (!res.ok) throw new Error("Failed to remove student from sports day");
    return res.json();
}
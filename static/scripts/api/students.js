// static/scripts/api/students.js

async function fetchStudentsForSportsDay(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/students`);
    if (!res.ok) throw new Error("Failed to load students");
    return res.json();
}

async function uploadStudentsCsv(sportsdayId, file) {
    const form = new FormData();
    form.append("file", file);

    return fetch(
        `/sportsdays/${sportsdayId}/students/upload`,
        { method: "POST", body: form }
    );
}

/* ✅ NEW */

async function updateStudent(studentId, payload) {
    return fetch(`/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}

async function createStudent(sportsdayId, payload) {
    return fetch(`/sportsdays/${sportsdayId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
}
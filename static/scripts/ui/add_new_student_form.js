import { findExistingStudent } from "../domain/students.js";

document.getElementById("newStudentForm").addEventListener("submit", async e => {
    e.preventDefault();
    

    const name = document.getElementById("newStudentName").value.trim();
    const house = document.getElementById("newStudentHouse").value.trim();
    const year = parseInt(document.getElementById("newStudentYear").value);

    if (!name || !house || !year) {
        showValidationErrors(["Please fill in all fields."]);
        return;
    }

    const existing = findExistingStudent(window.students, name, year);

    if (!existing) {
        // ✅ CASE 1: brand new student
        await window.onCreateStudent({ name, house, year });
        return;
    }

    // Student exists globally
    const alreadyParticipating =
        window.participation[existing.id]?.length > 0;

    if (alreadyParticipating) {
        showValidationErrors([
            "This student already exists and is already participating in this sports day."
        ]);
        return;
    }

    // ✅ CASE 2: student exists, add to this sports day
    await window.onAddStudentToSportsDay(existing.id);
});

// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings, loadConfiguredAgeCategories } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent } from "../api/students.js"
import { fetchEvents, toggleParticipation } from "../api/events.js"
import { loadParticipationSettings, applyYearGroupSettings } from "../ui/sportsday_settings.js"
import { populateHouseInputs } from "../ui/requirements_form.js"

import { renderEventsTable } from "../ui/events_table.js"
import { renderStudentsTable } from "../ui/students_table.js"

import { computeEventWarnings } from "../domain/events.js"
import { indexIssues } from "../domain/issues.js"

let duplicateLoaded = false;

async function loadSportsDay(sportsdayId) {
    const [sportsday, settings] = await Promise.all([
        fetchSportsDay(sportsdayId),
        fetchSportsDaySettings(sportsdayId)
    ]);

    document.getElementById("title").textContent =
        `Sports Day ${sportsday.year}`;

    document.getElementById("status").value = sportsday.status;
    document.getElementById("createEventBtn").href =
        `/admin/events/new?sportsday=${sportsdayId}`;


    loadParticipationSettings(settings)
    applyYearGroupSettings(settings);
    populateHouseInputs(settings.houses);

    await loadEvents(sportsdayId);
    await loadStudents(sportsdayId);
}

async function loadEvents(sportsdayId) {
    const [sportsDayEvents, allowedAgeCategories] = await Promise.all([
        fetchEvents(sportsdayId),
        loadConfiguredAgeCategories(sportsdayId)
    ]);


    const warnings = computeEventWarnings(
        sportsDayEvents,
        allowedAgeCategories
    );

    renderEventsTable(sportsDayEvents, warnings, sportsdayId);
}

async function loadStudents(sportsdayId, issues = []) {
    const data = await fetchStudentsForSportsDay(sportsdayId);

    /* ✅ newest first */
    data.students.sort((a, b) => b.id - a.id);

    renderStudentsTable({ ...data, issues });
}

/* ------------------------------ */
/* Callbacks for UI               */
/* ------------------------------ */

window.onUpdateStudent = async (studentId, payload) => {
    const res = await updateStudent(studentId, payload);
    if (!res.ok) alert("Failed to update student");
};

window.onCreateStudent = async payload => {
    const res = await createStudent(sportsdayId, payload);

    if (!res.ok) {
        const msg = await res.text();
        alert(msg);
        return;
    }

    await loadStudents(sportsdayId);
};

/* existing callback */
window.onToggleParticipation = async (eventId, studentId, on) => {
    const res = await toggleParticipation(eventId, studentId, on);
    if (!res.ok) alert("Unable to update participation");
};

const sportsdayId = parseInt(
    window.location.pathname.split("/").pop()
);

loadSportsDay(sportsdayId);
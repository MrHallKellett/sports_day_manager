// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings,
         updateSportsDayRequirements, loadConfiguredAgeCategories } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent } from "../api/students.js"
import { fetchEvents, toggleParticipation } from "../api/events.js"
import { loadParticipationSettings, applyYearGroupSettings } from "../ui/sportsday_settings.js"
import { populateHouseInputs, getSelectedYearGroups, getHouses } from "../ui/requirements_form.js"

import { renderEventsTable } from "../ui/events_table.js"
import { renderStudentsTable } from "../ui/students_table.js"

import { computeEventWarnings } from "../domain/events.js";
import { indexIssues } from "../domain/issues.js";
import { findExistingStudent } from "../domain/students.js";
import { getValue } from "./helpers.js"

import { showToast } from "../ui/toast.js";
import { showError } from "../ui/feedback.js";

let duplicateLoaded = false;

export function buildRequirementsPayload() {
    return {
        field_min: parseInt(getValue("fieldMin")),
        track_min: parseInt(getValue("trackMin")),
        overall_max: parseInt(getValue("overallMax")),
        year_groups: getSelectedYearGroups(),
        houses: getHouses()
    }
}

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

async function onSaveRequirements() {
    const payload = buildRequirementsPayload();

    try {
        await updateSportsDayRequirements(
            window.pageState.sportsDayId,
            payload
        );
        showToast("Requirements saved");
    } catch (err) {
        showError("Failed to save requirements");
    }
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



document.getElementById("newStudentForm").addEventListener("submit", async e => {
    e.preventDefault();
    alert("running")

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


/* existing callback */
window.onToggleParticipation = async (eventId, studentId, on) => {
    const res = await toggleParticipation(eventId, studentId, on);
    if (!res.ok) alert("Unable to update participation");
};

const sportsdayId = parseInt(
    window.location.pathname.split("/").pop()
);

loadSportsDay(sportsdayId);

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("saveRequirementsBtn");
    btn.addEventListener("click", onSaveRequirements);
});
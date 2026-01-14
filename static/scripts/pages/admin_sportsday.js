// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings,
         updateSportsDayRequirements, loadConfiguredAgeCategories, addStudentToSportsDay } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent } from "../api/students.js"
import { fetchEvents, toggleParticipation } from "../api/events.js"
import { loadParticipationSettings, applyYearGroupSettings } from "../ui/sportsday_settings.js"

import { populateHouseInputs, getSelectedYearGroups, addHouse, getHouses } from "../ui/requirements_form.js"

import { renderEventsTable } from "../ui/events_table.js"
import { renderStudentsTable } from "../ui/students_table.js"

import { computeEventWarnings } from "../domain/events.js";
import { indexIssues } from "../domain/issues.js";
import { findExistingStudent } from "../domain/students.js";
import { getValue } from "./helpers.js"

import { showToast } from "../ui/toast.js";
import { showError } from "../ui/feedback.js";
import { showErrors } from "../ui/feedback.js";

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

    // Pass student data to the table renderer
    renderStudentsTable({ ...data, issues });

    // Make student data available for the "add student" form
    attachNewStudentFormHandler(data.students);
}

async function onSaveRequirements() {
    const payload = buildRequirementsPayload();
    
    try {
        await updateSportsDayRequirements(
            sportsdayId,
            payload
        );
        showToast("Requirements saved");
    } catch (err) {
        showError(`Failed to save requirements ${err}`);
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
    // Step 1: Create the student globally
    const createRes = await createStudent(payload);

    if (!createRes.ok) {
        const msg = await createRes.text();
        alert(msg);
        return;
    }

    const { student } = await createRes.json();

    // Step 2: Add the newly created student to this specific sports day
    const addRes = await addStudentToSportsDay(sportsdayId, student.id);
    if (!addRes.ok) {
        const msg = await addRes.text();
        alert(`Student created, but failed to add to sports day: ${msg}`);
    }

    await loadStudents(sportsdayId);
};

/**
 * Attaches the submit event listener to the "Add New Student" form.
 * This needs the current list of students to check for duplicates.
 * @param {Array} students - The current list of student objects.
 */
function attachNewStudentFormHandler(students) {
    const form = document.getElementById("newStudentForm");
    // To prevent multiple listeners, we replace the node with a clone.
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener("submit", async e => {
        e.preventDefault();

        const name = document.getElementById("newStudentName").value.trim();
        const house = document.getElementById("newStudentHouse").value.trim();
        const year = parseInt(document.getElementById("newStudentYear").value);

        if (!name || !house || !year) {
            showErrors(["Please fill in all fields."]);
            return;
        }

        const existing = findExistingStudent(students, name, year);

        if (!existing) {
            // CASE 1: Brand new student
            await window.onCreateStudent({ name, house, year });
            newForm.reset(); // Clear the form
        } else {
            // CASE 2: Student already exists
            showErrors([
                "A student with this name and year already exists."
            ]);
        }
    });
}

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
    const saveReqsBtn = document.getElementById("saveRequirementsBtn");
    saveReqsBtn.addEventListener("click", onSaveRequirements);
    const addHouseBtn = document.getElementById("addHouseBtn");
    addHouseBtn.addEventListener("click", addHouse);

});

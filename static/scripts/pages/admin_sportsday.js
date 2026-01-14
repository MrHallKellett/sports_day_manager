// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings,
         updateSportsDayRequirements, loadConfiguredAgeCategories, addStudentToSportsDay } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent } from "../api/students.js"
import { fetchStaff, createStaff as createNewStaff } from "../api/staff_table.js";
import { fetchEvents, toggleParticipation } from "../api/events.js"
import { loadParticipationSettings, applyYearGroupSettings } from "../ui/sportsday_settings.js"

import { populateHouseInputs, getSelectedYearGroups, addHouse, getHouses } from "../ui/requirements_form.js"

import { renderEventsTable } from "../ui/events_table.js"
import { renderStudentsTable } from "../ui/students_table.js"
import { setupStaffForm, renderStaffTable } from "../ui/staff_table.js"

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
        // Pass settings object to student loader
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
    populateNewStudentDropdowns(settings);

    await loadEvents(sportsdayId);
    await loadStudents(sportsdayId, settings);
    await loadStaffSection(settings);
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

async function loadStudents(sportsdayId, settings, issues = []) {
    const data = await fetchStudentsForSportsDay(sportsdayId);

    /* ✅ newest first */
    data.students.sort((a, b) => b.id - a.id);

    // Pass student data and settings to the table renderer
    renderStudentsTable({ ...data, issues, settings });

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
        showToast("Requirements saved", { type: "success" });

        // Re-populate dropdowns and refresh tables to show new state
        populateNewStudentDropdowns(payload);
        await loadEvents(sportsdayId);
        // We need to refetch settings to get the full object for loadStudents
        const newSettings = await fetchSportsDaySettings(sportsdayId);
        await loadStudents(sportsdayId, newSettings);

    } catch (err) {
        showError(`Failed to save requirements ${err}`);
    }
}

async function loadStaffSection(settings) {
    try {
        const [staff, events] = await Promise.all([
            fetchStaff(),
            fetchEvents(sportsdayId)
        ]);
        renderStaffTable(staff, events);
        setupStaffForm(settings, events, onAddStaff);
    } catch (error) {
        showError(`Failed to load staff section: ${error.message}`);
    }
}

async function onAddStaff(payload) {
    const newStaff = await createNewStaff(payload);
    showToast(`Staff member ${newStaff.name} created with sign-in code: ${newStaff.sign_in_code}`, { type: 'success', duration: 10000 });
    const [staff, events] = await Promise.all([fetchStaff(), fetchEvents(sportsdayId)]);
    renderStaffTable(staff, events);
}

/* ------------------------------ */
/* Callbacks for UI               */
/* ------------------------------ */

window.onUpdateStudent = async (studentId, payload) => {
    const res = await updateStudent(studentId, payload);
    if (!res.ok) {
        showError("Failed to update student");
    } else {
        showToast("Student updated");
    }
    // Return the response so the caller can check success
    return res;
};

window.onCreateStudent = async payload => {
    // Step 1: Create the student globally
    const createRes = await createStudent(payload);
    if (!createRes.ok) {
        const msg = await createRes.text();
        showError(msg);
        return;
    }
    const { student } = await createRes.json();

    // Step 2: Add the newly created student to this specific sports day
    const addRes = await addStudentToSportsDay(sportsdayId, student.id);
    if (!addRes.ok) {
        const msg = await addRes.text();
        showError(`Student created, but failed to add to sports day: ${msg}`);
    }

    const settings = await fetchSportsDaySettings(sportsdayId);
    await loadStudents(sportsdayId, settings);
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
        const house = document.getElementById("newStudentHouse").value;
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

/**
 * Populates the House and Year dropdowns in the "Add New Student" form.
 * @param {object} settings - The sports day settings object.
 */
function populateNewStudentDropdowns(settings) {
    const houseSelect = document.getElementById("newStudentHouse");
    const yearSelect = document.getElementById("newStudentYear");

    // Populate houses
    houseSelect.innerHTML = '<option value="">Select House...</option>'; // Clear existing
    (settings.houses || []).forEach(house => {
        const option = new Option(house, house);
        houseSelect.add(option);
    });

    // Populate years, expanding Key Stages
    yearSelect.innerHTML = '<option value="">Select Year...</option>'; // Clear existing
    const yearSet = new Set();
    (settings.year_groups || []).forEach(yg => {
        if (yg === "KS4") {
            yearSet.add("10");
            yearSet.add("11");
        } else if (yg === "KS5") {
            yearSet.add("12");
            yearSet.add("13");
        } else {
            yearSet.add(String(yg));
        }
    });

    const sortedYears = Array.from(yearSet).sort((a, b) => parseInt(a) - parseInt(b));
    sortedYears.forEach(year => yearSelect.add(new Option(`Year ${year}`, year)));
}

/* existing callback */
window.onToggleParticipation = async (eventId, studentId, on) => {
    const res = await toggleParticipation(eventId, studentId, on);
    if (!res.ok) {
        const msg = await res.text();
        showError(`Unable to update participation: ${msg}`);
        return false;
    }

    if (on) { // Only check for warnings when adding a participant
        const data = await res.json();
        const state = data.new_state;
        if (state.max_per_house > 0 && state.house_participants > state.max_per_house) {
            const msg = `Warning: ${state.event_name} now has ${state.house_participants} participants for house ${state.student_house}.`;
            showToast(msg, { type: 'warning', duration: 6000 });
        }
    }
    return true; // Return true for both adding and removing
};

const sportsdayId = parseInt(
    window.location.pathname.split("/").pop()
);

// --- Entry Point ---

// Set up event listeners for buttons
const saveReqsBtn = document.getElementById("saveRequirementsBtn");
saveReqsBtn.addEventListener("click", onSaveRequirements);
const addHouseBtn = document.getElementById("addHouseBtn");
addHouseBtn.addEventListener("click", addHouse);

// --- Restore interactive year group selection ---
const combineKS4 = document.getElementById("combineKS4");
const combineKS5 = document.getElementById("combineKS5");
const y10 = document.getElementById("y10");
const y11 = document.getElementById("y11");
const y12 = document.getElementById("y12");
const y13 = document.getElementById("y13");

combineKS4.addEventListener("change", () => {
    const disabled = combineKS4.checked;
    y10.disabled = disabled;
    y11.disabled = disabled;
    if (disabled) {
        y10.checked = false;
        y11.checked = false;
    }
});

combineKS5.addEventListener("change", () => {
    const disabled = combineKS5.checked;
    y12.disabled = disabled;
    y13.disabled = disabled;
    if (disabled) {
        y12.checked = false;
        y13.checked = false;
    }
});

// Check for a toast message from a redirect (e.g., after editing an event)
const toastMessage = sessionStorage.getItem('toastMessage');
if (toastMessage) {
    showToast(toastMessage, { type: 'info', duration: 7000 });
    sessionStorage.removeItem('toastMessage'); // Clear after showing
}

// Load all initial data for the page
loadSportsDay(sportsdayId);

// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings,
         updateSportsDayRequirements, loadConfiguredAgeCategories, addStudentToSportsDay } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent, removeStudentFromSportsDay, uploadStudentsCsv } from "../api/students.js"
import { fetchStaff, createStaff as createNewStaff, deleteStaff, uploadStaffCsv } from "../api/staff_table.js";
import { fetchEvents, toggleParticipation, deleteEventById } from "../api/events.js"
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
import { showError, showConfirm } from "../ui/feedback.js";
import { showErrors } from "../ui/feedback.js";

let duplicateLoaded = false;
let sportsDayEventNames = []; // Store unique event names for CSV template

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
    // Attach listeners after rendering
    attachEventListeners('eventsTable', '.delete-event', 'eventId', onEventDelete);
}

async function loadStudents(sportsdayId, settings, issues = []) {
    const data = await fetchStudentsForSportsDay(sportsdayId);

    sportsDayEventNames = Object.keys(data.events_by_name);
    /* ✅ newest first */
    data.students.sort((a, b) => b.id - a.id);

    // Pass student data and settings to the table renderer
    renderStudentsTable({ ...data, issues, settings });

    // Make student data available for the "add student" form
    attachNewStudentFormHandler(data.students);
    // Attach listeners for remove buttons
    attachEventListeners('studentsTable', '.remove-student', 'studentId', onStudentRemove);
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
        // Attach listeners after rendering
        attachEventListeners('staffTable', '.delete-staff', 'staffId', onStaffDelete);
    } catch (error) {
        showError(`Failed to load staff section: ${error.message}`);
    }
}

async function onAddStaff(payload) {
    const newStaff = await createNewStaff(payload);
    showToast(`Staff member ${newStaff.name} created with sign-in code: ${newStaff.sign_in_code}`, { type: 'success', duration: 10000 });
    const [staff, events] = await Promise.all([fetchStaff(), fetchEvents(sportsdayId)]);
    renderStaffTable(staff, events);
    attachEventListeners('staffTable', '.delete-staff', 'staffId', onStaffDelete);
}

async function onStaffDelete(staffId) {
    const confirmed = await showConfirm({
        title: 'Delete Staff Member',
        bodyHtml: '<p>Are you sure you want to permanently delete this staff member? This action cannot be undone.</p>',
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteStaff(staffId);
        showToast('Staff member deleted.', { type: 'success' });
        const settings = await fetchSportsDaySettings(sportsdayId);
        await loadStaffSection(settings); // Reload the staff section
    } catch (error) {
        showError(`Failed to delete staff member: ${error.message}`);
    }
}

async function onEventDelete(eventId) {
    const confirmed = await showConfirm({
        title: 'Delete Event',
        bodyHtml: '<p>Are you sure you want to permanently delete this event and all its participants? This action cannot be undone.</p>',
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteEventById(eventId);
        showToast('Event deleted.', { type: 'success' });
        await loadEvents(sportsdayId); // Reload events
        const settings = await fetchSportsDaySettings(sportsdayId);
        await loadStudents(sportsdayId, settings); // Reload students as participation has changed
    } catch (error) {
        showError(`Failed to delete event: ${error.message}`);
    }
}

async function onStudentRemove(studentId, button) {
    const studentName = button.dataset.studentName;
    const confirmed = await showConfirm({
        title: `Remove ${studentName}?`,
        bodyHtml: `<p>Are you sure you want to remove <strong>${studentName}</strong> from this sports day? Their participation in all events for this day will be removed.</p>`,
        confirmText: 'Remove'
    });

    if (!confirmed) return;

    await removeStudentFromSportsDay(sportsdayId, studentId);
    showToast(`${studentName} removed from sports day.`, { type: 'success' });
    const settings = await fetchSportsDaySettings(sportsdayId);
    await loadStudents(sportsdayId, settings); // Reload students table
}

async function onUploadStaff(file) {
    if (!file) return;
    try {
        const result = await uploadStaffCsv(file);
        let message = `${result.created_staff} new staff member(s) created.`;
        if (result.skipped_staff > 0) {
            message += ` ${result.skipped_staff} skipped as they already exist.`;
        }
        showToast(message, { type: 'success', duration: 8000 });

        // Only reload if there were changes
        const settings = await fetchSportsDaySettings(sportsdayId);
        await loadStaffSection(settings); // Reload staff table
    } catch (error) {
        showError(`Upload failed: ${error.message}`);
    } finally {
        // Reset file input
        document.getElementById('staffCsvFile').value = '';
    }
}

function onDownloadStudentTemplate() {
    const headers = ['name', 'house', 'year', 'email', ...sportsDayEventNames];
    const csvContent = headers.join(',');
    downloadCsv(csvContent, 'student_template.csv');
}

function onDownloadStaffTemplate() {
    const headers = ['name', 'roles'];
    const csvContent = headers.join(',');
    downloadCsv(csvContent, 'staff_template.csv');
}

function downloadCsv(content, fileName) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

/**
 * Generic helper to attach delegated event listeners to a table.
 */
function attachEventListeners(tableId, selector, dataAttribute, callback) {
    const table = document.getElementById(tableId);
    table.addEventListener('click', e => {
        const target = e.target.closest(selector);
        if (target) {
            e.preventDefault();
            const id = parseInt(target.dataset[dataAttribute]);
            callback(id, target);
        }
    });
}

/**
 * Sets up the tabbed interface navigation.
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const panes = document.querySelectorAll('.tab-pane');

    function switchTab(tabName) {
        tabs.forEach(tab => {
            const isSelected = tab.dataset.tab === tabName;
            tab.classList.toggle('border-blue-600', isSelected);
            tab.classList.toggle('text-blue-600', isSelected);
            tab.classList.toggle('border-transparent', !isSelected);
            tab.classList.toggle('text-gray-500', !isSelected);
            tab.classList.toggle('hover:text-gray-700', !isSelected);
            tab.classList.toggle('hover:border-gray-300', !isSelected);
        });

        panes.forEach(pane => {
            pane.style.display = pane.dataset.pane === tabName ? 'block' : 'none';
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    switchTab('requirements'); // Set the initial tab
}

const sportsdayId = parseInt(
    window.location.pathname.split("/").pop()
);

// --- Entry Point ---

// Set up event listeners for buttons
const saveReqsBtn = document.getElementById("saveRequirementsBtn");
saveReqsBtn.addEventListener("click", onSaveRequirements);
const addHouseBtn = document.getElementById("addHouseBtn");
addHouseBtn.addEventListener("click", addHouse);
const downloadStudentTemplateBtn = document.getElementById("downloadStudentTemplateBtn");
downloadStudentTemplateBtn.addEventListener("click", onDownloadStudentTemplate);
const downloadStaffTemplateBtn = document.getElementById("downloadStaffTemplateBtn");
downloadStaffTemplateBtn.addEventListener("click", onDownloadStaffTemplate);
const staffCsvInput = document.getElementById('staffCsvFile');
staffCsvInput.addEventListener('change', (e) => onUploadStaff(e.target.files[0]));

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
setupTabs();
loadSportsDay(sportsdayId);

// static/scripts/pages/admin_sportsday.js

import { fetchSportsDay, fetchSportsDaySettings,
         updateSportsDayRequirements, loadConfiguredAgeCategories, addStudentToSportsDay } from "../api/sportsdays.js"
import { fetchStudentsForSportsDay, createStudent, updateStudent, removeStudentFromSportsDay } from "../api/students.js"
import { fetchStaff, createStaff as createNewStaff, deleteStaff, uploadStaffCsv, updateStaffAssignment } from "../api/staff_table.js"
import { fetchEvents, toggleParticipation, deleteEventById, uploadEventsCsv, fetchDuplicateEventOptions, duplicateEvent } from "../api/events.js";
import { loadParticipationSettings, applyYearGroupSettings } from "../ui/sportsday_settings.js"

import { populateHouseInputs, getSelectedYearGroups, addHouse, getHouses } from "../ui/requirements_form.js"

import { renderEventsTable } from "../ui/events_table.js"
import { renderStudentsTable } from "../ui/students_table.js"
import { setupStaffForm, renderStaffTable, appendStaffRow } from "../ui/staff_table.js"
import { computeEventWarnings } from "../domain/events.js";
import { indexIssues } from "../domain/issues.js";
import { findExistingStudent } from "../domain/students.js";
import { getValue } from "./helpers.js"

import { showToast } from "../ui/toast.js";
import { showError, showConfirm } from "../ui/feedback.js";
import { showErrors } from "../ui/feedback.js";
import { uploadStudentsCsv } from "../api/students.js";

let sportsDayEventNames = []; // Store unique event names for CSV template
let currentSportsDaySettings = {}; // Cache settings for reuse
let allSportsDayEvents = []; // Cache events for reuse

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

    currentSportsDaySettings = settings; // Cache settings
    allSportsDayEvents = (await fetchEvents(sportsdayId)); // Cache events

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
    await loadHistory(sportsdayId);
}
async function loadHistory(sportsdayId) { // This function was duplicated, this is the correct one.
    try {
        const res = await fetch(`/sportsdays/${sportsdayId}/history`);
        if (!res.ok) throw new Error('Failed to load history');
        const history = await res.json();
        renderHistoryTable(history);
    } catch (error) {
        showError(`Failed to load history: ${error.message}`);
    }
}

function renderHistoryTable(history) {
    const tbody = document.getElementById('historyTable');
    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td class="py-4 text-center text-gray-500">No history found.</td></tr>';
        return;
    }

    history.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'border-b';
        tr.innerHTML = `<td class="p-2 align-top text-gray-500 whitespace-nowrap">${new Date(log.timestamp).toLocaleString()}</td><td class="p-2"><span class="font-semibold">${log.user_info}</span> ${log.action}</td>`;
        tbody.appendChild(tr);
    });
}

async function loadEvents(sportsdayId) {
    const [sportsDayEvents, allowedAgeCategories, settings] = await Promise.all([
        fetchEvents(sportsdayId),
        loadConfiguredAgeCategories(sportsdayId),
        fetchSportsDaySettings(sportsdayId) // Needed for inline editing dropdowns
    ]);

    const warnings = computeEventWarnings(
        sportsDayEvents,
        allowedAgeCategories
    );

    renderEventsTable(sportsDayEvents, warnings, sportsdayId, settings);
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
            fetchStaff(sportsdayId),
            fetchEvents(sportsdayId)
        ]);
        renderStaffTable(staff, allSportsDayEvents, currentSportsDaySettings); // Use cached data
        setupStaffForm(currentSportsDaySettings, allSportsDayEvents, onAddStaff);
        // Attach listeners after rendering
        attachEventListeners('staffTable', '.delete-staff', 'staffId', onStaffDelete);
    } catch (error) {
        showError(`Failed to load staff section: ${error.message}`);
    }
}

async function onAddStaff(payload) {
    try {
        const newStaffAssignment = await createNewStaff(sportsdayId, payload);
        showToast(`Staff member ${newStaffAssignment.name} created with sign-in code: ${newStaffAssignment.sign_in_code}`, { type: 'success', duration: 10000 });
        
        // Dynamically add the new staff member to the table instead of reloading
        appendStaffRow(newStaffAssignment, allSportsDayEvents, currentSportsDaySettings);
    } catch (error) {
        showError(`Failed to add staff: ${error.message}`);
    }
}

async function onStaffDelete(assignmentId) {
    const confirmed = await showConfirm({
        title: 'Delete Staff Member',
        bodyHtml: '<p>Are you sure you want to permanently delete this staff member? This action cannot be undone.</p>',
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteStaff(assignmentId);
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
        const result = await uploadStaffCsv(sportsdayId, file);
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

async function onUploadStudents(file) {
    if (!file) return;
    const warningsDiv = document.getElementById('uploadWarnings');
    warningsDiv.classList.add('hidden'); // Hide previous warnings

    try {
        const res = await uploadStudentsCsv(sportsdayId, file);
        const result = await res.json();

        if (!res.ok) {
            // The backend sends a JSON error object on failure
            throw new Error(result.message || 'An unknown error occurred during upload.');
        }

        let message = `${result.created} new student(s) created, ${result.linked} linked to this sports day, and ${result.updated} updated.`;
        showToast(message, { type: 'success', duration: 8000 });

        let warningsHtml = '';

        if (result.updates && result.updates.length > 0) {
            warningsHtml += `
                <h4 class="font-bold mb-2 text-blue-700">Updated Students:</h4>
                <ul class="list-disc pl-5 text-sm mb-4">
                    ${result.updates.map(u => `<li><strong>${u.name} (Y${u.year})</strong>: ${u.change}</li>`).join('')}
                </ul>`;
        }

        if (result.issues && result.issues.length > 0) {
            warningsHtml += `
                <h4 class="font-bold mb-2 text-red-700">Skipped Rows:</h4>
                <p class="text-sm mb-2">The following students were in the file but could not be processed:</p>
                <ul class="list-disc pl-5 text-sm">
                    ${result.issues.map(i => `<li><strong>Row ${i.row} (${i.name})</strong>: ${i.reason}</li>`).join('')}
                </ul>`;
        }

        if (warningsHtml) {
            warningsDiv.innerHTML = warningsHtml;
            warningsDiv.classList.remove('hidden');
        } else {
            warningsDiv.classList.add('hidden');
        }

        const settings = await fetchSportsDaySettings(sportsdayId);
        await loadStudents(sportsdayId, settings, result.issues);
    } catch (error) {
        showError(`Upload failed: ${error.message}`);
    } finally {
        // Reset file input to allow re-uploading the same file
        document.getElementById('csvFile').value = '';
    }
}

async function onToggleDuplicateDropdown() {
    const dropdown = document.getElementById('duplicateDropdown');
    const optionsContainer = document.getElementById('duplicateOptionsContainer');
    const isHidden = dropdown.classList.toggle('hidden');
    // Add a listener to close the dropdown if the user clicks elsewhere
    if (!isHidden) document.addEventListener('click', closeDuplicateDropdownOnClickOutside, { once: true });

    if (!isHidden) {
        try {
            optionsContainer.innerHTML = '<div class="px-4 py-2 text-sm text-gray-500">Loading...</div>';
            const options = await fetchDuplicateEventOptions();

            if (options.length === 0) {
                optionsContainer.innerHTML = '<div class="px-4 py-2 text-sm text-gray-500">No events found to duplicate</div>';
                return;
            }

            optionsContainer.innerHTML = ''; // Clear loading message
            options.forEach(opt => {
                const optionText = `${opt.sports_day_name} - Y${opt.event_year_group} - ${opt.event_name}`;
                const item = document.createElement('a');
                item.href = '#';
                item.className = 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 truncate';
                item.textContent = optionText;
                item.dataset.eventId = opt.event_id;
                item.setAttribute('role', 'menuitem');
                item.onclick = (e) => {
                    e.preventDefault();
                    onConfirmDuplicate(opt.event_id);
                    dropdown.classList.add('hidden'); // Close dropdown on selection
                };
                optionsContainer.appendChild(item);
            });
        } catch (error) {
            showError(`Failed to load events for duplication: ${error.message}`);
            optionsContainer.innerHTML = '<div class="px-4 py-2 text-sm text-red-500">Error loading events</div>';
        }
    }
}

async function onConfirmDuplicate(sourceEventId) {
    if (!sourceEventId) return;
    await duplicateEvent(sportsdayId, sourceEventId);
    showToast('Event duplicated successfully. A "copy" has been added to the name.', { type: 'success' });
    await loadEvents(sportsdayId);
}

window.onEventUpdated = async () => {
    // 1. Re-fetch the events to get the latest data and update the shared cache.
    allSportsDayEvents = await fetchEvents(sportsdayId);
    // Re-render the staff table to reflect the changes in event names/details.
    await loadStaffSection();
};

function closeDuplicateDropdownOnClickOutside(event) {
    const dropdown = document.getElementById('duplicateDropdown');
    const button = document.getElementById('duplicateEventBtn');
    if (dropdown && !dropdown.contains(event.target) && !button.contains(event.target)) {
        dropdown.classList.add('hidden');
    }
}

function onDownloadStudentTemplate() {
    const headers = ['name', 'house', 'year', ...Object.keys(sportsDayEventNames)];
    const csvContent = headers.join(',');
    downloadCsv(csvContent, 'student_template.csv');
}

function onDownloadStaffTemplate() {
    const headers = ['name', 'email', 'roles'];
    const csvContent = headers.join(',');
    downloadCsv(csvContent, 'staff_template.csv');
}

function convertToCsv(data) {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + (row[header] ?? '')).replace(/"/g, '""');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
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

window.onUpdateStaffAssignment = async (assignmentId, payload) => {
    try {
        const updatedAssignment = await updateStaffAssignment(assignmentId, payload);
        showToast("Staff assignment updated");
        return updatedAssignment; // Return the updated data on success
    } catch (error) {
        showError(`Failed to update staff assignment: ${error.message}`);
        throw error; // Re-throw the error so the calling function knows it failed
    }
};

window.onCreateStudent = async payload => {
    // Step 1: Create the student globally
    const createRes = await createStudent(payload, sportsdayId);
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

    // Check session storage for a tab to activate
    const activeTab = sessionStorage.getItem('activeAdminTab') || 'requirements';
    if (activeTab) {
        switchTab(activeTab);
    }
}

const sportsdayId = parseInt(
    window.location.pathname.split("/").pop()
);

document.addEventListener('DOMContentLoaded', async () => {
    // --- Security Check ---
    const authCode = sessionStorage.getItem('staffAuthCode');
    if (!authCode) {
        // If no auth code is present at all, redirect to login.
        window.location.href = '/staff/login';
        return; // Stop further execution
    }
    // The backend will handle if this specific code is valid for this sportsdayId.
    // This client-side check is a first line of defense.

    // --- Entry Point ---

    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', () => {
        sessionStorage.removeItem('staffAuthCode');
        window.location.href = '/staff/login';
    });

    // Set up event listeners for buttons
    const saveReqsBtn = document.getElementById("saveRequirementsBtn");
    if (saveReqsBtn) saveReqsBtn.addEventListener("click", onSaveRequirements);
    const addHouseBtn = document.getElementById("addHouseBtn");
    if (addHouseBtn) addHouseBtn.addEventListener("click", addHouse);
    const downloadStudentTemplateBtn = document.getElementById("downloadStudentTemplateBtn");
    if (downloadStudentTemplateBtn) downloadStudentTemplateBtn.addEventListener("click", onDownloadStudentTemplate);
    const downloadStaffTemplateBtn = document.getElementById("downloadStaffTemplateBtn");
    if (downloadStaffTemplateBtn) downloadStaffTemplateBtn.addEventListener("click", onDownloadStaffTemplate);
    const downloadEventsTemplateBtn = document.getElementById("downloadEventsTemplateBtn");
    if (downloadEventsTemplateBtn) downloadEventsTemplateBtn.addEventListener("click", onDownloadEventsTemplate);
    const eventsCsvInput = document.getElementById('eventsCsvFile');
    if (eventsCsvInput) eventsCsvInput.addEventListener('change', (e) => onUploadEvents(e.target.files[0]));
    const studentCsvInput = document.getElementById('csvFile');
    if (studentCsvInput) studentCsvInput.addEventListener('change', (e) => onUploadStudents(e.target.files[0]));
    const duplicateEventBtn = document.getElementById('duplicateEventBtn');
    if (duplicateEventBtn) duplicateEventBtn.addEventListener('click', onToggleDuplicateDropdown);
    const staffCsvInput = document.getElementById('staffCsvFile');
    if (staffCsvInput) staffCsvInput.addEventListener('change', (e) => onUploadStaff(e.target.files[0]));




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
    await loadSportsDay(sportsdayId); // Await the async function call
});

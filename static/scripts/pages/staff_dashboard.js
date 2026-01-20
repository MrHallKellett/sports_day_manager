// static/scripts/pages/staff_dashboard.js

import { fetchStudentsForSportsDay } from '../api/students.js';
import { renderStudentsTable } from '../ui/students_table.js';
import { toggleParticipation, fetchEventResults, startRace, finishRace, updateResult } from '../api/events.js';
import { showToast } from '../ui/toast.js';
import { showError, showConfirm } from '../ui/feedback.js';
import { fetchSportsDaySettings } from '../api/sportsdays.js'; // Import to get full settings

async function fetchDashboardData(code) {
    const res = await fetch(`/staff/dashboard-data?code=${code}`);
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'Failed to load dashboard data.');
    }
    return res.json();
}

function setupTabs(roles, sportsdayId, assignment, code) {
    const tabs = document.querySelectorAll('.tab-button');
    const panes = document.querySelectorAll('.tab-pane');
    let firstVisibleTab = null;

    tabs.forEach(tab => {
        const tabName = tab.dataset.tab;
        // Determine which tabs to show based on roles
        const isVisible = (tabName === 'students' && roles.includes('Form Tutor')) || (tabName === 'results' && roles.includes('Event Steward'));

        if (isVisible) {
            tab.classList.remove('hidden');
            if (!firstVisibleTab) {
                firstVisibleTab = tabName;
            }
        }
    });

    function switchTab(tabName) {
        tabs.forEach(tab => {
            const isSelected = tab.dataset.tab === tabName;
            tab.classList.toggle('border-blue-600', isSelected);
            tab.classList.toggle('text-blue-600', isSelected);
            tab.classList.toggle('border-transparent', !isSelected);
        });

        panes.forEach(pane => {
            pane.style.display = pane.dataset.pane === tabName ? 'block' : 'none';
        });

        // Load data for the activated tab
        if (tabName === 'students' && roles.includes('Form Tutor')) {
            loadStudentData(sportsdayId, assignment);
        }
        if (tabName === 'results' && roles.includes('Event Steward')) {
            // The results tab setup is now called here
            setupResultsTab(assignment.assigned_event_objects, code);
        }
    }

    if (firstVisibleTab) {
        switchTab(firstVisibleTab);
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

async function loadStudentData(sportsdayId, assignment) { // Pass assignment here
    try {
        const allStudentsData = await fetchStudentsForSportsDay(sportsdayId);
        const sportsDaySettings = await fetchSportsDaySettings(sportsdayId); // Fetch full settings for highlighting

        let filteredStudents = allStudentsData.students;

        const isFormTutor = assignment.roles.includes('Form Tutor');
        const isEventSteward = assignment.roles.includes('Event Steward');

        // Filtering logic for student visibility
        if (isFormTutor && assignment.assigned_classes && assignment.assigned_classes.length > 0) {
            const tutorClasses = new Set(assignment.assigned_classes); // e.g., {'Y10 - HouseA'}
            filteredStudents = filteredStudents.filter(student => {
                const studentClass = `Y${student.year} - ${student.house}`;
                return tutorClasses.has(studentClass);
            });
        } else if (isEventSteward && assignment.assigned_event_objects && assignment.assigned_event_objects.length > 0) {
            // Extract unique year groups from assigned events
            const assignedEventYearGroups = new Set();
            assignment.assigned_event_objects.forEach(event => { // event is an object { name: '...', year_group: '7', ... }
                const year = parseInt(event.year_group);
                if (!isNaN(year)) assignedEventYearGroups.add(year);
            });

            if (assignedEventYearGroups.size > 0) {
                filteredStudents = filteredStudents.filter(student =>
                    assignedEventYearGroups.has(student.year)
                );
            } else {
                filteredStudents = []; // If Event Steward but no assigned events, show no students
            }
        } else {
            filteredStudents = []; // If no specific role or assignments, show no students by default for staff
        }

        allStudentsData.students = filteredStudents; // Update the students array with the filtered list

        // Pass the full data, settings, and staff assignment to renderStudentsTable
        renderStudentsTable({
            ...allStudentsData,
            settings: sportsDaySettings, // Pass actual sports day settings
            staffAssignment: assignment // Pass the full assignment object
        });
    } catch (error) {
        showError(`Failed to load students: ${error.message}`);
    }
}
// Make toggle participation available globally for the students table
window.onToggleParticipation = async (eventId, studentId, on) => {
    const code = new URLSearchParams(window.location.search).get('code');
    const res = await toggleParticipation(eventId, studentId, on, code);
    if (!res.ok) {
        const msg = await res.text();
        showError(`Unable to update participation: ${msg}`);
        return false;
    }
    return true;
};

async function setupResultsTab(assignedEvents, code) {
    const eventSelect = document.getElementById('event-results-select');
    const resultsContainer = document.getElementById('event-results-container');

    if (!assignedEvents || assignedEvents.length === 0) {
        eventSelect.classList.add('hidden');
        resultsContainer.innerHTML = '<p class="text-gray-500">You have no events assigned.</p>';
        return;
    }

    eventSelect.innerHTML = '<option value="">Select an event...</option>';
    assignedEvents.forEach(event => {
        const option = new Option(`Y${event.year_group} ${event.name}`, event.id);
        option.dataset.resultFormat = event.result_format;
        eventSelect.add(option);
    });

    eventSelect.addEventListener('change', async (e) => {
        const eventId = e.target.value;
        if (!eventId) {
            resultsContainer.innerHTML = '';
            return;
        }
        const selectedOption = e.target.options[e.target.selectedIndex];
        const resultFormat = selectedOption.dataset.resultFormat;
        await loadAndRenderResults(eventId, resultFormat, code);
    });
}

async function loadAndRenderResults(eventId, resultFormat, code) {
    const resultsContainer = document.getElementById('event-results-container');
    resultsContainer.innerHTML = '<p>Loading results...</p>';
    try {
        const resultsData = await fetchEventResults(eventId, code);
        renderResultsTable(resultsData, eventId, resultFormat, code);
    } catch (error) {
        showError(`Failed to load results: ${error.message}`);
        resultsContainer.innerHTML = `<p class="text-red-500">Error loading results.</p>`;
    }
}

function renderResultsTable(data, eventId, resultFormat, code) {
    const container = document.getElementById('event-results-container');
    container.innerHTML = '';

    // Add "Start Race" button if applicable
    if (['time', 'duration'].includes(resultFormat)) {
        const startButton = document.createElement('button');
        startButton.id = 'startRaceBtn';
        startButton.className = 'mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700';
        startButton.textContent = 'START RACE';
        startButton.addEventListener('click', async () => {
            try {
                await startRace(eventId, code);
                showToast('Race started!', { type: 'success' });
                await loadAndRenderResults(eventId, resultFormat, code); // Refresh
            } catch (error) {
                showError(`Failed to start race: ${error.message}`);
            }
        });
        container.appendChild(startButton);
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    table.innerHTML = `
        <thead class="bg-gray-50">
            <tr>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">House</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finish Time</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200"></tbody>
    `;
    container.appendChild(table);
    const tbody = table.querySelector('tbody');

    // Calculate ranks
    const finishedParticipants = data
        .filter(d => d.result?.result_value != null)
        .sort((a, b) => a.result.result_value - b.result.result_value);
    const ranks = new Map(finishedParticipants.map((p, i) => [p.student.id, i + 1]));

    data.sort((a, b) => a.student.name.localeCompare(b.student.name)).forEach(item => {
        const { student, result } = item;
        const tr = document.createElement('tr');

        const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleTimeString() : '—';
        const formatResult = (seconds) => seconds != null ? `${seconds.toFixed(2)}s` : '—';

        const startTimeCell = createEditableCell(result?.start_time, student.id, 'start_time', eventId, resultFormat, code);
        const finishTimeCell = createEditableCell(result?.finish_time, student.id, 'finish_time', eventId, resultFormat, code);

        // Create all cells as DOM elements to preserve event listeners
        const nameCell = document.createElement('td');
        nameCell.className = 'p-2 whitespace-nowrap';
        nameCell.textContent = student.name;

        const yearCell = document.createElement('td');
        yearCell.className = 'p-2 whitespace-nowrap';
        yearCell.textContent = student.year;

        const houseCell = document.createElement('td');
        houseCell.className = 'p-2 whitespace-nowrap';
        houseCell.textContent = student.house;

        const resultCell = document.createElement('td');
        resultCell.className = 'p-2 whitespace-nowrap font-semibold';
        resultCell.textContent = formatResult(result?.result_value);

        const rankCell = document.createElement('td');
        rankCell.className = 'p-2 whitespace-nowrap';
        rankCell.textContent = ranks.get(student.id) || '—';

        const actionsCell = document.createElement('td');
        actionsCell.className = 'p-2 whitespace-nowrap';

        // Append all cells in order
        tr.appendChild(nameCell);
        tr.appendChild(yearCell);
        tr.appendChild(houseCell);
        tr.appendChild(startTimeCell);
        tr.appendChild(finishTimeCell);
        tr.appendChild(resultCell);
        tr.appendChild(rankCell);
        tr.appendChild(actionsCell);

        if (['time', 'duration'].includes(resultFormat) && result?.start_time && !result.finish_time) {
            const finishButton = document.createElement('button');
            finishButton.className = 'px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700';
            finishButton.textContent = 'FINISH';
            finishButton.addEventListener('click', async () => {
                try {
                    await finishRace(eventId, student.id, code);
                    showToast('Finish time recorded!', { type: 'success' });
                    await loadAndRenderResults(eventId, resultFormat, code); // Refresh
                } catch (error) {
                    showError(`Failed to record finish: ${error.message}`);
                }
            });
            actionsCell.appendChild(finishButton);
        }

        tbody.appendChild(tr);
    });
}

function createEditableCell(isoString, studentId, field, eventId, resultFormat, code) {
    const td = document.createElement('td');
    td.className = 'p-2 whitespace-nowrap';
    
    if (isoString) {
        // Display the time in HKT timezone, regardless of the user's local machine time.
        td.textContent = new Date(isoString).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Hong_Kong',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    } else {
        td.textContent = '—';
    }

    td.addEventListener('dblclick', () => {
        const originalValue = td.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.className = 'w-full p-1 border rounded';
        td.innerHTML = '';
        td.appendChild(input);
        input.focus(); // Focus the input, but don't select the text

        const save = async () => {
            const newTimeValue = input.value.trim();

            // If the value is unchanged, just revert silently.
            if (newTimeValue === originalValue) {
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
                return;
            }

            let confirmed = false;
            let payloadValue = null;

            if (!newTimeValue && originalValue !== '—') {
                // --- DELETION ---
                confirmed = await showConfirm({
                    title: 'Confirm Deletion',
                    bodyHtml: `<p>Are you sure you want to delete the previous result: <strong>${originalValue}</strong>?</p>`,
                    confirmText: 'Delete'
                });
                if (confirmed) {
                    payloadValue = null; // Send null to the backend to clear the value
                }
            } else {
                // --- EDIT ---
                confirmed = await showConfirm({
                    title: 'Confirm Change',
                    bodyHtml: `<p>Are you sure you want to change <strong>${originalValue}</strong> to <strong>${newTimeValue}</strong>?</p>`,
                    confirmText: 'Confirm'
                });
                if (confirmed) {
                    // To avoid timezone issues, manually construct the new ISO string.
                    const originalDatePart = new Date(isoString).toISOString().split('T')[0];
                    const newHktDateTimeString = `${originalDatePart}T${newTimeValue}+08:00`;
                    payloadValue = new Date(newHktDateTimeString).toISOString();
                }
            }

            // If user cancelled the confirmation, revert the cell and stop.
            if (!confirmed) {
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
                return;
            }

            try {
                await updateResult(eventId, studentId, { [field]: payloadValue });
                showToast('Result updated!', { type: 'success' });
                // Refresh the entire table to recalculate results and ranks
                await loadAndRenderResults(eventId, resultFormat, code);
            } catch (error) {
                showError(`Failed to update time: ${error.message}`);
                td.textContent = originalValue; // Revert on failure
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur(); // Triggers the save function
            } else if (e.key === 'Escape') {
                e.preventDefault();
                // To prevent the 'blur' event from firing, we must remove its listener first
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
            }
        });
    });
    return td;
}


document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
        document.body.innerHTML = '<div class="p-4 text-red-600">Error: No sign-in code provided. Please <a href="/staff/login" class="underline">log in</a> again.</div>';
        return;
    }

    try {
        const data = await fetchDashboardData(code);
        const { assignment, sports_day } = data;

        // --- Build detailed logged-in user string ---
        let loggedInText = `Logged in as: ${assignment.name}`;
        const roleDetails = [];
        if (assignment.roles.includes('Form Tutor') && assignment.assigned_classes?.length > 0) {
            roleDetails.push(`Form Tutor (${assignment.assigned_classes.join(', ')})`);
        }
        if (assignment.roles.includes('Event Steward') && assignment.assigned_event_objects?.length > 0) {
            const eventNames = assignment.assigned_event_objects.map(e => `Y${e.year_group} ${e.name}`);
            roleDetails.push(`Event Steward (${eventNames.join(', ')})`);
        } else if (assignment.roles.includes('Event Steward')) {
            // Handle case where steward has no events assigned yet
            roleDetails.push('Event Steward (No events assigned)');
        }

        if (roleDetails.length > 0) {
            loggedInText += ` - ${roleDetails.join(' / ')}`;
        }


        // --- Update UI with fetched data ---
        document.getElementById('title').textContent = `Sports Day ${sports_day.year}`;
        document.getElementById('loggedInUser').textContent = loggedInText;

        // --- Setup UI based on roles ---
        setupTabs(assignment.roles, sports_day.id, assignment, code);

        document.getElementById('logoutBtn').addEventListener('click', () => {
            window.location.href = '/staff/login';
        });

    } catch (error) {
        showError(error.message);
        document.getElementById('loggedInUser').textContent = 'Could not log in.';
    }
});
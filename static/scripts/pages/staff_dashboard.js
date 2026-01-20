// static/scripts/pages/staff_dashboard.js

import { fetchStudentsForSportsDay } from '../api/students.js';
import { renderStudentsTable } from '../ui/students_table.js';
import { getSexAbbreviation } from '../domain/events.js';
import { toggleParticipation } from '../api/events.js';
import { setupResultsTab } from '../ui/results_table.js';
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
            // Format event names for display in the dropdown
            const formattedEvents = assignment.assigned_event_objects.map(e => ({
                ...e,
                display_name: `Y${e.year_group}${getSexAbbreviation(e.sex)} ${e.name}`
            }));
            // The results tab setup is now called here
            setupResultsTab(formattedEvents, code);
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
                const studentClass = `Y${student.year} ${student.house}`;
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
            const eventNames = assignment.assigned_event_objects.map(e => `Y${e.year_group}${getSexAbbreviation(e.sex)} ${e.name}`);
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
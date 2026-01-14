// static/scripts/ui/staff_table.js

import { showToast } from "./toast.js";
import { getEventNamesFromIds } from "../domain/staff_table.js";

export function setupStaffForm(settings, events, onAddStaff) {
    const form = document.getElementById('newStaffForm');
    const roleFormTutor = document.getElementById('roleFormTutor');
    const roleEventSteward = document.getElementById('roleEventSteward');
    const tutorAssignments = document.getElementById('formTutorAssignments');
    const stewardAssignments = document.getElementById('eventStewardAssignments');

    roleFormTutor.addEventListener('change', () => tutorAssignments.classList.toggle('hidden', !roleFormTutor.checked));
    roleEventSteward.addEventListener('change', () => stewardAssignments.classList.toggle('hidden', !roleEventSteward.checked));

    populateAssignmentSelects(settings, events);

    // Use a cloned form to prevent multiple listeners on re-renders
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('newStaffName').value;
        const roles = Array.from(newForm.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
        const assigned_classes = Array.from(document.getElementById('assignClasses').selectedOptions).map(opt => opt.value);
        const assigned_events = Array.from(document.getElementById('assignEvents').selectedOptions).map(opt => parseInt(opt.value));

        // Pass data up to the controller
        onAddStaff({ name, roles, assigned_classes, assigned_events });
        newForm.reset();
        document.getElementById('formTutorAssignments').classList.add('hidden');
        document.getElementById('eventStewardAssignments').classList.add('hidden');
    });
}

function populateAssignmentSelects(settings, events) {
    const classSelect = document.getElementById('assignClasses');
    const eventSelect = document.getElementById('assignEvents');
    classSelect.innerHTML = '';
    eventSelect.innerHTML = '';

    // Populate classes (Year + House)
    const years = new Set();
    (settings.year_groups || []).forEach(yg => {
        if (yg === "KS4") { years.add("10"); years.add("11"); }
        else if (yg === "KS5") { years.add("12"); years.add("13"); }
        else { years.add(String(yg)); }
    });

    (settings.houses || []).forEach(house => {
        years.forEach(year => {
            const className = `Year ${year} - ${house}`;
            classSelect.add(new Option(className, className));
        });
    });

    // Populate events
    events.forEach(event => {
        const eventName = `${event.name} (Year ${event.year_group})`;
        eventSelect.add(new Option(eventName, event.id));
    });
}

export function renderStaffTable(allStaff, allEvents) {
    const headerRow = document.getElementById('staff-header-row');
    const filterRow = document.getElementById('staff-filter-row');
    const tbody = document.getElementById('staffTable');

    headerRow.innerHTML = `
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer">Name</th>
        <th class="sticky top-0 bg-gray-50 p-2">Sign-in Code</th>
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer">Roles</th>
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer">Assigned Classes</th>
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer">Assigned Events</th>
    `;
    filterRow.innerHTML = `
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="name" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="roles" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="assigned_classes" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="assigned_events" placeholder="Filter..." class="w-full text-xs p-1"></th>
    `;

    tbody.innerHTML = '';
    if (allStaff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">No staff members found.</td></tr>';
        return;
    }

    allStaff.forEach(staff => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-2 py-1">${staff.name}</td>
            <td class="px-2 py-1 font-mono">${staff.sign_in_code}</td>
            <td class="px-2 py-1">${(staff.roles || []).join(', ')}</td>
            <td class="px-2 py-1">${(staff.assigned_classes || []).join(', ')}</td>
            <td class="px-2 py-1">${getEventNamesFromIds(staff.assigned_events || [], allEvents).join(', ')}</td>
        `;
        tbody.appendChild(tr);
    });

    // Basic filtering
    const filterInputs = filterRow.querySelectorAll('input[data-filter]');
    filterInputs.forEach(input => {
        input.addEventListener('input', () => applyStaffFilters(allEvents));
    });
}

function applyStaffFilters(allEvents) {
    const filters = Array.from(document.querySelectorAll('#staff-filter-row input[data-filter]')).map(el => ({
        key: el.dataset.filter,
        value: el.value.toLowerCase()
    }));

    document.querySelectorAll('#staffTable tr').forEach(row => {
        let isVisible = true;
        filters.forEach(filter => {
            if (!filter.value) return;
            let cellIndex = -1;
            if (filter.key === 'name') cellIndex = 0;
            if (filter.key === 'roles') cellIndex = 2;
            if (filter.key === 'assigned_classes') cellIndex = 3;
            if (filter.key === 'assigned_events') cellIndex = 4;

            if (cellIndex !== -1) {
                const cellText = row.cells[cellIndex].textContent.toLowerCase();
                if (!cellText.includes(filter.value)) {
                    isVisible = false;
                }
            }
        });
        row.style.display = isVisible ? '' : 'none';
    });
}



// static/scripts/ui/staff_table.js

import { showToast } from "./toast.js";
import { getEventNamesFromIds } from "../domain/staff_table.js";

export function setupStaffForm(settings, events, onAddStaff) {
    const form = document.getElementById('newStaffForm');
    
    // Use a cloned form to prevent multiple listeners on re-renders
    const newForm = form.cloneNode(true);
    
    
    const roleFormTutor = newForm.querySelector('#roleFormTutor');
    const roleEventSteward = newForm.querySelector('#roleEventSteward');
    const tutorAssignments = newForm.querySelector('#formTutorAssignments');
    const stewardAssignments = newForm.querySelector('#eventStewardAssignments');
    
    roleFormTutor.addEventListener('change', () => tutorAssignments.classList.toggle('hidden', !roleFormTutor.checked));
    roleEventSteward.addEventListener('change', () => stewardAssignments.classList.toggle('hidden', !roleEventSteward.checked));
    
    populateAssignmentSelects(newForm, settings, events);

    // Use a cloned form to prevent multiple listeners on re-renders
    
    form.parentNode.replaceChild(newForm, form);
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newForm.querySelector('#newStaffName').value;
        const emailInput = newForm.querySelector('#newStaffEmail');
        const email = emailInput ? emailInput.value : '';
        const roles = Array.from(newForm.querySelectorAll('input[name="roles"]:checked')).map(cb => cb.value);
        const assigned_classes = roleFormTutor.checked ? Array.from(newForm.querySelector('#assignClasses').selectedOptions).map(opt => opt.value) : [];
        const assigned_events = roleEventSteward.checked ? Array.from(newForm.querySelector('#assignEvents').selectedOptions).map(opt => parseInt(opt.value)) : [];

        // Pass data up to the controller
        onAddStaff({ name, email, roles, assigned_classes, assigned_events });
        newForm.reset();
        tutorAssignments.classList.add('hidden');
        stewardAssignments.classList.add('hidden');
    });
}

function populateAssignmentSelects(form, settings, events) {
    const classSelect = form.querySelector('#assignClasses');
    const eventSelect = form.querySelector('#assignEvents');
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
            const className = `Y${year} - ${house}`;
            classSelect.add(new Option(className, className));
        });
    });

    // Populate events
    events.forEach(event => {
        const eventName = `Y${event.year_group} ${event.name}`;
        eventSelect.add(new Option(eventName, event.id));
    });
}

export function renderStaffTable(allStaff, allEvents) {
    const headerRow = document.getElementById('staff-header-row');
    const filterRow = document.getElementById('staff-filter-row');
    const tbody = document.getElementById('staffTable');

    headerRow.innerHTML = `
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sign-in Code</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roles</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Classes</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Events</th>
        <th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
    `;
    filterRow.innerHTML = `
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="name" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="email" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="roles" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="assigned_classes" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="assigned_events" placeholder="Filter..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"></th>
    `;

    tbody.innerHTML = '';
    if (allStaff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No staff members found.</td></tr>';
        return;
    }

    allStaff.forEach(staff => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-2 py-1">${staff.name}</td>
            <td class="px-2 py-1">${staff.email || ''}</td>
            <td class="px-2 py-1 font-mono">${staff.sign_in_code}</td>
            <td class="px-2 py-1">${(staff.roles || []).join(', ')}</td>
            <td class="px-2 py-1">${(staff.assigned_classes || []).join(', ')}</td>
            <td class="px-2 py-1">${getEventNamesFromIds(staff.assigned_events || [], allEvents).join(', ')}</td>
            <td class="px-2 py-1">
                <button data-staff-id="${staff.id}"
                        class="delete-staff text-red-600 hover:underline text-xs">
                    Delete
                </button>
            </td>
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
            if (filter.key === 'email') cellIndex = 1;
            if (filter.key === 'roles') cellIndex = 3;
            if (filter.key === 'assigned_classes') cellIndex = 4;
            if (filter.key === 'assigned_events') cellIndex = 5;

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

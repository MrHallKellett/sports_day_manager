// static/scripts/ui/staff_table.js
import { getSexAbbreviation } from '../domain/events.js';

import { getClassesFromSettings } from '../domain/classes.js';
import { showConfirm } from '../ui/feedback.js';

export function setupStaffForm(settings, events, onAddStaff) {
    const form = document.getElementById('newStaffForm');
    if (!form) return; // Guard against running on wrong page

    const roleAdminCb = document.getElementById('newStaffRoleAdmin');
    const roleFormTutorCb = document.getElementById('newStaffRoleFormTutor');
    const roleEventStewardCb = document.getElementById('newStaffRoleEventSteward');
    const roleCheckboxes = [roleAdminCb, roleFormTutorCb, roleEventStewardCb];
    
    const classesSelect = document.getElementById('assignClasses');
    const eventsSelect = document.getElementById('assignEvents');

    // Populate classes
    const classes = getClassesFromSettings(settings);
    classesSelect.innerHTML = '';
    classes.forEach(c => classesSelect.add(new Option(c, c)));

    // Populate events
    eventsSelect.innerHTML = '';
    events.forEach(e => eventsSelect.add(new Option(`Y${e.year_group}${getSexAbbreviation(e.sex)} ${e.name}`, e.id)));
    
    function updateFormBasedOnRoles() {
        const selectedRoles = roleCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
        
        // Show/hide assignment sections
        document.getElementById('assignClassesContainer').style.display = selectedRoles.includes('Form Tutor') ? 'block' : 'none';
        document.getElementById('assignEventsContainer').style.display = selectedRoles.includes('Event Steward') ? 'block' : 'none';

        // Enforce role constraints
        if (roleAdminCb.checked) {
            // If Admin is checked, disable and uncheck others
            roleFormTutorCb.disabled = true;
            roleEventStewardCb.disabled = true;
            roleFormTutorCb.checked = false;
            roleEventStewardCb.checked = false;
        } else if (roleFormTutorCb.checked || roleEventStewardCb.checked) {
            // If Form Tutor or Event Steward is checked, disable Admin
            roleAdminCb.disabled = true;
        } else {
            // If no roles are checked, enable all
            roleAdminCb.disabled = false;
            roleFormTutorCb.disabled = false;
            roleEventStewardCb.disabled = false;
        }
    }

    roleCheckboxes.forEach(cb => cb.addEventListener('change', updateFormBasedOnRoles));
    updateFormBasedOnRoles(); // Initial check

    // Handle form submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newStaffName').value.trim();
        if (!name) {
            alert("Staff name is required.");
            return;
        }
        const selectedRoles = roleCheckboxes.filter(cb => cb.checked).map(cb => cb.value);
        const payload = {
            name: name,
            email: document.getElementById('newStaffEmail').value,
            roles: selectedRoles,
            assigned_classes: selectedRoles.includes('Form Tutor') ? Array.from(classesSelect.selectedOptions).map(opt => opt.value) : [],
            assigned_events: selectedRoles.includes('Event Steward') ? Array.from(eventsSelect.selectedOptions).map(opt => opt.value).map(Number) : []
        };
        await onAddStaff(payload);
        form.reset();
        updateFormBasedOnRoles(); // Reset form state
    };
}

export function renderStaffTable(staff, allEvents, settings) {
    const table = document.getElementById('staffTable'); // Now correctly targets the <table>
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('staffTableBody'); // Correctly targets the <tbody>
    
    // 1. Render Headers
    const headers = ['Name', 'Email', 'Roles', 'Assigned Classes', 'Assigned Events', 'Sign-in Code', 'Actions'];
    thead.innerHTML = `
        <tr>
            ${headers.map(h => `<th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${h}</th>`).join('')}
        </tr>
    `;

    // 2. Render Body
    tbody.innerHTML = '';

    const eventsById = new Map(allEvents.map(e => [e.id, `Y${e.year_group} ${e.name}`]));
    const allPossibleClasses = getClassesFromSettings(settings);

    staff.forEach(assignment => {
        const tr = createStaffRow(assignment, allEvents, settings, eventsById, allPossibleClasses);
        tbody.appendChild(tr);
    });
}

export function appendStaffRow(assignment, allEvents, settings) {
    const tbody = document.getElementById('staffTableBody');
    const tr = createStaffRow(assignment, allEvents, settings);
    tbody.prepend(tr); // Add to the top of the table
}

function makeCellEditable(td, assignment, field, config, fields) {
    const originalValue = td.textContent;
    td.innerHTML = '';

    let input;
    if (config.type === 'multiselect') {
        input = document.createElement('select');
        input.multiple = true;
        input.className = 'w-full h-24 p-1 border rounded';
        const currentValues = new Set(config.current || []);

        config.options.forEach(opt => {
            const optionValue = typeof opt === 'object' ? opt.value : opt;
            const optionText = typeof opt === 'object' ? opt.text : opt;
            const isSelected = currentValues.has(optionValue);
            const option = new Option(optionText, optionValue, false, isSelected);
            input.add(option);
        });

        // Add event listeners to enforce role constraints within the multiselect
        input.addEventListener('change', () => {
            const selectedOptions = Array.from(input.selectedOptions).map(o => o.value);
            const isAdminSelected = selectedOptions.includes('Admin');
            const isOtherSelected = selectedOptions.includes('Form Tutor') || selectedOptions.includes('Event Steward');

            Array.from(input.options).forEach(option => {
                if (isAdminSelected) {
                    // If Admin is selected, disable other roles
                    option.disabled = (option.value === 'Form Tutor' || option.value === 'Event Steward');
                } else if (isOtherSelected) {
                    // If other roles are selected, disable Admin
                    option.disabled = (option.value === 'Admin');
                } else {
                    option.disabled = false;
                }
            });
        });
    } else {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'w-full p-1 border rounded';
        input.value = originalValue === '—' ? '' : originalValue;
    }

    td.appendChild(input);
    input.focus();

    function revert() {
        td.textContent = originalValue;
    }

    async function save() {
        let newValues;
        let newText;

        if (config.type === 'multiselect') {
            const selectedOptions = Array.from(input.selectedOptions);
            newValues = selectedOptions.map(opt => opt.value);
            newText = selectedOptions.map(opt => opt.text).join(', ');

            // For events, values are IDs (numbers). Convert them.
            if (field === 'assigned_events') {
                newValues = newValues.map(Number);
            }
        } else {
            newValues = input.value.trim();
            newText = newValues;
        }

        // Validation: name is required, email can be blank
        if (field === 'name' && !newValues) {
            alert("Staff name cannot be blank.");
            revert();
            return;
        }

        const originalText = (config.type === 'multiselect')
            ? (assignment[field] || []).map(val => {
                if (field === 'assigned_events') {
                    const event = config.options.find(o => o.value === val);
                    return event ? event.text : '';
                }
                return val;
            }).join(', ')
            : assignment[field] || '';

        if (newText === originalText) {
            revert();
            return;
        }

        // Optimistically update UI
        td.textContent = newText || '—';

        // Send update to backend
        try {
            let payload = { [field]: newValues };

            // Special handling for role changes to add confirmation and clear related assignments
            if (field === 'roles') {
                const oldRoles = new Set(assignment.roles || []);
                const newRoles = new Set(newValues || []);

                const wasFormTutor = oldRoles.has('Form Tutor');
                const isNowFormTutor = newRoles.has('Form Tutor');
                const wasEventSteward = oldRoles.has('Event Steward');
                const isNowEventSteward = newRoles.has('Event Steward');

                const confirmationMessages = [];
                if (wasFormTutor && !isNowFormTutor) {
                    confirmationMessages.push("Removing 'Form Tutor' role will unassign all classes.");
                    payload.assigned_classes = []; // Prepare to clear classes
                }
                if (wasEventSteward && !isNowEventSteward) {
                    confirmationMessages.push("Removing 'Event Steward' role will unassign all events.");
                    payload.assigned_events = []; // Prepare to clear events
                }

                if (confirmationMessages.length > 0) {
                    const confirmed = await showConfirm({
                        title: 'Confirm Role Change',
                        bodyHtml: `<p>Are you sure you want to proceed?</p><ul class="list-disc pl-5 mt-2 text-sm text-red-600"><li>${confirmationMessages.join('</li><li>')}</li></ul>`,
                        confirmText: 'Confirm'
                    });

                    if (!confirmed) {
                        revert();
                        return;
                    }
                }
            }

            let updatedAssignment = await window.onUpdateStaffAssignment(assignment.id, payload);
            assignment = updatedAssignment; // Refresh the local assignment object with the new data

            // If roles were changed, dynamically update the clickability of other cells in the row.
            if (field === 'roles') {
                const newRoles = updatedAssignment.roles;
                const tr = td.parentElement;
                const classesCell = tr.querySelector('td[data-field="assigned_classes"]');
                const eventsCell = tr.querySelector('td[data-field="assigned_events"]');

                const canEditClasses = newRoles.includes('Form Tutor') && !newRoles.includes('Admin');
                const newClassesCell = updateCellClickability(classesCell, canEditClasses, updatedAssignment, 'assigned_classes', fields.assigned_classes);

                const canEditEvents = newRoles.includes('Event Steward') && !newRoles.includes('Admin');
                const newEventsCell = updateCellClickability(eventsCell, canEditEvents, updatedAssignment, 'assigned_events', fields.assigned_events);

                // Also update the text of the cleared cells
                if (payload.assigned_classes?.length === 0) newClassesCell.textContent = '—';
                if (payload.assigned_events?.length === 0) newEventsCell.textContent = '—';
            }

        } catch (error) {
            alert(`Update failed: ${error.message}`);
            // Revert on failure
            revert();
        }
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            e.preventDefault();
            input.removeEventListener('blur', save);
            revert();
        }
        // Note: 'Enter' doesn't make sense for multi-select, so we don't handle it.
    });
}

/**
 * A helper function to add or remove the dblclick listener for a cell.
 */
function updateCellClickability(cell, isEditable, assignment, key, config) {
    // First, remove any existing listener to prevent duplicates.
    // A simple way is to clone the node, which removes all listeners.
    const newCell = cell.cloneNode(true);
    cell.parentNode.replaceChild(newCell, cell);

    if (isEditable) {
        newCell.addEventListener('dblclick', () => makeCellEditable(newCell, assignment, key, config));
    }

    return newCell; // Return the new cell so it can be further manipulated
}

function createStaffRow(assignment, allEvents, settings, eventsById, allPossibleClasses) {
    // If maps aren't provided, create them. This allows the function to be self-contained.
    if (!eventsById) eventsById = new Map(allEvents.map(e => [e.id, `Y${e.year_group} ${e.name}`]));
    if (!allPossibleClasses) allPossibleClasses = getClassesFromSettings(settings);

    const tr = document.createElement('tr');
    tr.className = 'border-b';

    const fields = {
        name: { value: assignment.name, type: 'text' },
        email: { value: assignment.email || '', type: 'text' },
        roles: { value: assignment.roles.join(', '), type: 'multiselect', options: ['Admin', 'Form Tutor', 'Event Steward'], current: assignment.roles },
        assigned_classes: { value: (assignment.assigned_classes || []).join(', '), type: 'multiselect', options: allPossibleClasses, current: assignment.assigned_classes || [] }, // Note: allPossibleClasses is just a list of strings
        assigned_events: { value: (assignment.assigned_events || []).map(id => eventsById.get(id)).join(', '), type: 'multiselect', options: allEvents.map(e => ({ text: `Y${e.year_group}${getSexAbbreviation(e.sex)} ${e.name}`, value: e.id })), current: assignment.assigned_events },
        sign_in_code: { value: assignment.sign_in_code, type: 'readonly' },
        actions: { value: '', type: 'actions' }
    };

    for (const [key, config] of Object.entries(fields)) {
        const td = document.createElement('td');
        td.className = 'p-2';
        td.textContent = config.value || '—';
        td.dataset.field = key;

        if (config.type === 'actions') {
            td.innerHTML = `<button data-staff-id="${assignment.id}" class="delete-staff text-red-600 hover:underline text-xs">Delete</button>`;
        } else if (config.type !== 'readonly') {
            let isEditable = true;
            const hasAdminRole = assignment.roles.includes('Admin');
            if (key === 'assigned_classes') isEditable = assignment.roles.includes('Form Tutor') && !hasAdminRole;
            else if (key === 'assigned_events') isEditable = assignment.roles.includes('Event Steward') && !hasAdminRole;
            
            if (isEditable) {
                td.addEventListener('dblclick', () => makeCellEditable(td, assignment, key, config, fields));
            }
        }
        tr.appendChild(td);
    }
    return tr;
}
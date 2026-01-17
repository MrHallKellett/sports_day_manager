// static/scripts/ui/events_table.js
import { updateEvent } from '../api/events.js';
import { showToast } from './toast.js';

const EDITABLE_FIELDS = [
    'name', 'year_group', 'category', 'result_format',
    'min_participants', 'max_participants', 'scoring_places',
    'points_1st', 'points_nth', 'min_per_house', 'max_per_house'
];

export function renderEventsTable(events, warnings, sportsdayId, settings) {
    const table = document.getElementById('eventsTable');
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('eventsTableBody');

    thead.innerHTML = `
        <tr>
            ${EDITABLE_FIELDS.map(f => `<th class="sticky top-0 bg-gray-50 p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${f.replace(/_/g, ' ')}</th>`).join('')}
            <th class="sticky top-0 bg-gray-50 p-2">Actions</th>
        </tr>
    `;

    tbody.innerHTML = '';
    if (events.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${EDITABLE_FIELDS.length + 1}" class="text-center py-4">No events found.</td></tr>`;
        return;
    }

    events.forEach(event => {
        const tr = document.createElement('tr');
        tr.dataset.eventId = event.id;

        EDITABLE_FIELDS.forEach(field => {
            const td = document.createElement('td');
            td.className = 'px-2 py-1 whitespace-nowrap text-sm text-gray-900';
            td.textContent = event[field];
            td.dataset.field = field;
            td.addEventListener('dblclick', () => makeCellEditable(td, event, field, settings));
            tr.appendChild(td);
        });

        const actionsTd = document.createElement('td');
        actionsTd.className = 'px-2 py-1';
        actionsTd.innerHTML = `
            <a href="/admin/events/${event.id}/edit" class="text-indigo-600 hover:underline text-xs mr-2">Edit</a>
            <button data-event-id="${event.id}" class="delete-event text-red-600 hover:underline text-xs">Delete</button>
        `;
        tr.appendChild(actionsTd);

        tbody.appendChild(tr);
    });
}

function makeCellEditable(td, event, field, settings) {
    const originalValue = td.textContent;
    td.innerHTML = ''; // Clear the cell

    let input;
    const yearGroups = new Set();
    (settings.year_groups || []).forEach(yg => {
        if (yg === "KS4") { yearGroups.add("KS4"); }
        else if (yg === "KS5") { yearGroups.add("KS5"); }
        else { yearGroups.add(String(yg)); }
    });

    if (field === 'year_group') {
        input = document.createElement('select');
        Array.from(yearGroups).sort().forEach(yg => {
            const option = new Option(yg, yg);
            input.add(option);
        });
    } else if (field === 'category' || field === 'result_format') {
        input = document.createElement('select');
        const options = field === 'category' ? ['track', 'field'] : ['time', 'distance', 'points'];
        options.forEach(opt => input.add(new Option(opt, opt)));
    }
    else {
        input = document.createElement('input');
        input.type = (field.includes('participants') || field.includes('points') || field.includes('places') || field.includes('house')) ? 'number' : 'text';
    }

    input.className = "border rounded px-2 py-1 w-full text-sm";
    input.value = originalValue;
    td.appendChild(input);
    input.focus();

    function revert() {
        td.textContent = originalValue;
        td.addEventListener('dblclick', () => makeCellEditable(td, event, field, settings));
    }

    async function save() {
        const newValue = input.value;

        // Detach listeners to prevent multiple saves
        input.removeEventListener('blur', save);
        input.removeEventListener('keydown', handleKeydown);

        if (newValue !== originalValue) {
            td.textContent = newValue; // Optimistic update
            try {
                await updateEvent(event.id, { [field]: newValue });
                showToast('Event updated successfully.', { type: 'success' });
                event[field] = newValue; // Update local data object
            } catch (error) {
                showToast(`Update failed: ${error.message}`, { type: 'error' });
                td.textContent = originalValue; // Revert on failure
            }
        } else {
            td.textContent = originalValue;
        }
        td.addEventListener('dblclick', () => makeCellEditable(td, event, field, settings));
    }

    function handleKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            revert();
        }
    }

    input.addEventListener('blur', save);
    input.addEventListener('keydown', handleKeydown);
}
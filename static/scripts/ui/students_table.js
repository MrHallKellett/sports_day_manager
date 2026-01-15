// static/scripts/ui/students_table.js

import { indexIssues } from "../domain/issues.js"
import { findMatchingEvent } from "../domain/events.js"

// Module-level state to track sorting
let currentSort = {
    columnIndex: null,
    direction: 'asc' // 'asc' or 'desc'
};

export function renderStudentsTable({
    students,
    events_by_name,
    participation,
    issues = [],
    settings,
    event_participation_counts = {}, // Default to empty object
    events_by_id = {} // Default to empty object
    }) {
    const issueMap = indexIssues(issues);
    const eventNames = Object.keys(events_by_name);

    const headerRow = document.getElementById("student-header-row");
    headerRow.innerHTML = `
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer" data-column-index="0">Name</th>
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer" data-column-index="1">House</th>
        <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer" data-column-index="2">Year</th>
        ${eventNames.map((n, i) => `
            <th class="sticky top-0 bg-gray-50 p-2 cursor-pointer" data-column-index="${i + 3}">${n}</th>
        `).join("")}
        <th class="sticky top-0 bg-gray-50 p-2">Actions</th>
    `;

    const filterRow = document.getElementById("student-filter-row");
    filterRow.innerHTML = `
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="name" placeholder="Filter name..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="house" placeholder="Filter house..." class="w-full text-xs p-1"></th>
        <th class="sticky top-10 bg-gray-100 p-1"><input type="text" data-filter="year" placeholder="Filter year..." class="w-full text-xs p-1"></th>
        ${eventNames.map((name, i) => `
            <th class="sticky top-10 bg-gray-100 p-1">
                <select data-filter="event" data-event-index="${i}" class="w-full text-xs p-1">
                    <option value="all">All</option><option value="yes">Yes</option><option value="no">No</option>
                </select>
            </th>
        `).join("")}
    `;

    const tbody = document.getElementById("studentsTable");
    tbody.innerHTML = "";

    /* ✅ Existing students */
    for (const s of students) {
        tbody.appendChild(
            renderStudentRow(s, students, eventNames, events_by_name, participation, issueMap, settings, event_participation_counts, events_by_id)
        );
    }

    filterRow.addEventListener("input", applyFilters);
    headerRow.addEventListener("click", handleSort);
    document.getElementById("showHighlightsBtn").addEventListener("click", toggleHighlights);

    // If highlights are currently active, re-apply them to the new rows
    if (document.body.classList.contains('show-row-highlights')) {
        applyHighlights();
    }
}

/* ------------------------------ */
/* New student row                */
/* ------------------------------ */


/* ------------------------------ */
/* Existing student row           */
/* ------------------------------ */

function renderStudentRow(
    student,
    students, // Pass in the full list
    eventNames,
    events_by_name,
    participation,
    issueMap,
    settings,
    event_participation_counts,
    events_by_id
) {
    const issue = issueMap[student.name];
    const tr = document.createElement("tr");
    tr.dataset.studentId = student.id;
    const status = calculateStudentStatus(student, participation[student.id] || [], settings, events_by_name, event_participation_counts, events_by_id);
    tr.dataset.highlightStatus = status;

    // Create Name, House, and Year cells as non-editable text initially
    const nameTd = createStudentInfoCell(student.name, () => makeCellEditable(nameTd, student, 'name', settings, events_by_name, participation, event_participation_counts, events_by_id));
    const houseTd = createStudentInfoCell(student.house, () => makeCellEditable(houseTd, student, 'house', settings, events_by_name, participation, event_participation_counts, events_by_id));
    const yearTd = createStudentInfoCell(student.year, () => makeCellEditable(yearTd, student, 'year', settings, events_by_name, participation, event_participation_counts, events_by_id));

    if (issue?.house_invalid) houseTd.classList.add("cell-warning");
    if (issue?.year_invalid) yearTd.classList.add("cell-warning");

    tr.appendChild(nameTd);
    tr.appendChild(houseTd);
    tr.appendChild(yearTd);

    // Event Checkboxes
    for (const eventName of eventNames) {
        const eventsForName = events_by_name[eventName];
        const matchedEvent = findMatchingEvent(eventsForName, student.year);

        const td = document.createElement("td");
        td.className = "text-center";
        if (!matchedEvent) {
            td.textContent = "—";
        } else {
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked =
                participation[student.id]?.includes(matchedEvent.id);

            cb.addEventListener("change", async () => {
                const success = await window.onToggleParticipation(
                    matchedEvent.id,
                    student.id,
                    cb.checked
                );

                if (success) {
                    // Update the local participation data model
                    const studentParticipation = participation[student.id] || [];
                    if (cb.checked) {
                        // Add student to event
                        studentParticipation.push(matchedEvent.id);
                        // Increment house count for this event
                        event_participation_counts[matchedEvent.id] = event_participation_counts[matchedEvent.id] || {};
                        event_participation_counts[matchedEvent.id][student.house] = (event_participation_counts[matchedEvent.id][student.house] || 0) + 1;
                    } else {
                        // Remove student from event
                        const index = studentParticipation.indexOf(matchedEvent.id);
                        if (index > -1) studentParticipation.splice(index, 1);
                        // Decrement house count for this event
                        if (event_participation_counts[matchedEvent.id]?.[student.house]) {
                            event_participation_counts[matchedEvent.id][student.house]--;
                        }
                    }
                    participation[student.id] = studentParticipation;

                    // Re-highlight all rows as this change can affect others
                    if (document.body.classList.contains('show-row-highlights')) {
                        document.querySelectorAll('#studentsTable tr').forEach(row => {
                            const studentId = parseInt(row.dataset.studentId);
                            const studentData = students.find(s => s.id === studentId); // students is from closure
                            if (studentData) {
                                updateRowHighlight(row, studentData, participation, settings, events_by_name, event_participation_counts, events_by_id);
                            }
                        });
                    }
                }
            });

            td.appendChild(cb);
        }

        tr.appendChild(td);
    }

    // Actions Cell
    const actionsTd = document.createElement("td");
    actionsTd.className = "px-2 py-1";
    actionsTd.innerHTML = `
        <button data-student-id="${student.id}"
                data-student-name="${student.name}"
                class="remove-student text-red-600 hover:underline text-xs">
            Remove
        </button>
    `;
    tr.appendChild(actionsTd);

    return tr;
}

function createStudentInfoCell(text, onDoubleClick) {
    const td = document.createElement("td");
    td.className = "px-2 py-1";
    td.textContent = text;
    td.addEventListener('dblclick', onDoubleClick);
    return td;
}

function makeCellEditable(td, student, field, settings, events_by_name, participation, event_participation_counts, events_by_id) {
    const originalValue = td.textContent;
    const tr = td.closest('tr');
    td.innerHTML = ''; // Clear the cell

    let input;

    if (field === 'house') {
        input = document.createElement('select');
        (settings.houses || []).forEach(house => {
            const option = new Option(house, house);
            input.add(option);
        });
    } else if (field === 'year') {
        input = document.createElement('select');
        const yearSet = new Set();
        (settings.year_groups || []).forEach(yg => {
            if (yg === "KS4") { yearSet.add("10"); yearSet.add("11"); }
            else if (yg === "KS5") { yearSet.add("12"); yearSet.add("13"); }
            else { yearSet.add(String(yg)); }
        });
        const sortedYears = Array.from(yearSet).sort((a, b) => parseInt(a) - parseInt(b));
        sortedYears.forEach(year => input.add(new Option(`Year ${year}`, year)));
    } else { // 'name'
        input = document.createElement('input');
        input.type = 'text';
    }

    input.className = "border rounded px-2 py-1 w-full";
    input.value = originalValue;
    td.appendChild(input);
    input.focus();

    function revert() {
        td.textContent = originalValue;
    }

    async function save() {
        const newValue = (field === 'year') ? parseInt(input.value) : input.value;

        if (String(newValue) !== originalValue) {
            // Optimistically update UI
            td.textContent = newValue;

            // Update student object for highlight recalculation
            const oldStudentData = { ...student };
            student[field] = newValue;

            // Send update to backend
            const res = await window.onUpdateStudent(student.id, { [field]: newValue });

            if (res.ok) {
                // Recalculate and apply the new status
                updateRowHighlight(tr, student, participation, settings, events_by_name, event_participation_counts, events_by_id);
            } else {
                // Revert on failure
                student[field] = oldStudentData[field]; // Revert student object
                td.textContent = originalValue;
                updateRowHighlight(tr, student, participation, settings, events_by_name, event_participation_counts, events_by_id);
            }
        } else {
            revert();
        }
    }

    input.addEventListener('blur', save);

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // Trigger save
        } else if (e.key === 'Escape') {
            e.preventDefault();
            revert();
            // Manually remove blur listener to prevent save on escape
            input.removeEventListener('blur', save);
        }
    });
}

function updateRowHighlight(tr, student, participation, settings, eventsByName, event_participation_counts, events_by_id) {
    const newStatus = calculateStudentStatus(student, participation[student.id] || [], settings, eventsByName, event_participation_counts, events_by_id);
    tr.dataset.highlightStatus = newStatus;

    // If highlights are currently active, update the class
    if (document.body.classList.contains('show-row-highlights')) {
        // Remove old highlight classes
        tr.classList.remove('row-highlight-ok', 'row-highlight-warning', 'row-highlight-error');
        // Add the new one
        tr.classList.add(`row-highlight-${newStatus}`);
    }
}

function calculateStudentStatus(student, participationIds, settings, eventsByName, event_participation_counts, events_by_id) {
    const allowedHouses = new Set(settings.houses || []);
    const allowedYears = new Set();
    (settings.year_groups || []).forEach(yg => {
        if (yg === "KS4") { allowedYears.add("10"); allowedYears.add("11"); }
        else if (yg === "KS5") { allowedYears.add("12"); allowedYears.add("13"); }
        else { allowedYears.add(String(yg)); }
    });

    // --- Red/Error Checks ---
    if (!student.name || !student.house || !student.year) return 'error';
    if (!allowedHouses.has(student.house)) return 'error';
    if (!allowedYears.has(String(student.year))) return 'error';

    // --- Red/Error Check for House Quota ---
    for (const eventId of participationIds) {
        const event = events_by_id[eventId];
        if (event && event.max_per_house > 0) {
            const houseCount = event_participation_counts[eventId]?.[student.house] || 0;
            if (houseCount > event.max_per_house) {
                return 'error';
            }
        }
    }

    // --- Orange/Warning Checks ---
    let trackCount = 0;
    let fieldCount = 0;

    participationIds.forEach(eventId => {
        const event = events_by_id[eventId];
        if (event && event.category) {
            if (event.category === 'track') trackCount++;
            if (event.category === 'field') fieldCount++;
        }
    });

    if (settings.track_min > 0 && trackCount < settings.track_min) return 'warning';
    if (settings.field_min > 0 && fieldCount < settings.field_min) return 'warning';
    if (settings.overall_max > 0 && participationIds.length > settings.overall_max) return 'warning';

    // --- Green/OK ---
    return 'ok';
}

function toggleHighlights(e) {
    const btn = e.currentTarget;
    const isShowing = document.body.classList.toggle('show-row-highlights');

    if (isShowing) {
        btn.textContent = "Hide Highlights";
        btn.classList.remove('bg-gray-200', 'text-gray-800');
        btn.classList.add('bg-indigo-600', 'text-white');
        applyHighlights();
    } else {
        btn.textContent = "Show Highlights";
        btn.classList.add('bg-gray-200', 'text-gray-800');
        btn.classList.remove('bg-indigo-600', 'text-white');
        clearHighlights();
    }
}

function applyHighlights() {
    document.querySelectorAll('#studentsTable tr[data-highlight-status]').forEach(row => {
        row.classList.add(`row-highlight-${row.dataset.highlightStatus}`);
    });
}

function clearHighlights() {
    document.querySelectorAll('#studentsTable tr').forEach(row => {
        row.className = row.className.replace(/row-highlight-\w+/g, '');
    });
}

function applyFilters() {
    const filters = Array.from(document.querySelectorAll("#student-filter-row [data-filter]")).map(el => {
        if (el.tagName === 'SELECT') {
            return { type: 'event', value: el.value, index: parseInt(el.dataset.eventIndex) };
        }
        return { type: el.dataset.filter, value: el.value.toLowerCase() };
    });

    const nameFilter = filters.find(f => f.type === 'name').value;
    const houseFilter = filters.find(f => f.type === 'house').value;
    const yearFilter = filters.find(f => f.type === 'year').value;
    const eventFilters = filters.filter(f => f.type === 'event');

    const rows = document.querySelectorAll("#studentsTable tr");

    rows.forEach(row => {
        const nameInput = row.cells[0].querySelector('input, select');
        const houseInput = row.cells[1].querySelector('input, select');
        const yearInput = row.cells[2].querySelector('input, select');

        // Get value from input if in edit mode, otherwise from the cell's text content.
        const name = (nameInput ? nameInput.value : row.cells[0].textContent).toLowerCase();
        const house = (houseInput ? houseInput.value : row.cells[1].textContent).toLowerCase();
        const year = (yearInput ? yearInput.value : row.cells[2].textContent).toLowerCase();


        let isVisible = true;

        if (nameFilter && !name.includes(nameFilter)) isVisible = false;
        if (houseFilter && !house.includes(houseFilter)) isVisible = false;
        if (yearFilter && !year.includes(yearFilter)) isVisible = false;

        eventFilters.forEach(filter => {
            if (filter.value === 'all') return;

            // +3 to account for Name, House, Year columns
            const eventCell = row.cells[filter.index + 3];
            const checkbox = eventCell.querySelector('input[type="checkbox"]');

            if (!checkbox) return; // Inapplicable event for this student

            const isParticipating = checkbox.checked;
            if (filter.value === 'yes' && !isParticipating) isVisible = false;
            if (filter.value === 'no' && isParticipating) isVisible = false;
        });

        row.style.display = isVisible ? "" : "none";
    });
}

function handleSort(e) {
    const header = e.target.closest('th');
    if (!header || header.dataset.columnIndex === undefined) return;

    const columnIndex = parseInt(header.dataset.columnIndex);

    // Determine sort direction
    let direction = 'asc';
    if (currentSort.columnIndex === columnIndex && currentSort.direction === 'asc') {
        direction = 'desc';
    }

    // Update sort state
    currentSort = { columnIndex, direction };

    // Sort and re-render
    sortAndReorderTable(columnIndex, direction);
}

function sortAndReorderTable(columnIndex, direction) {
    const tbody = document.getElementById("studentsTable");
    const rows = Array.from(tbody.querySelectorAll("tr"));

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex];
        const cellB = rowB.cells[columnIndex];

        let valueA, valueB;

        // Handle event columns (checkboxes)
        if (columnIndex >= 3) {
            const inputA = cellA.querySelector('input[type="checkbox"]');
            const inputB = cellB.querySelector('input[type="checkbox"]');
            valueA = inputA ? inputA.checked : false;
            valueB = inputB ? inputB.checked : false;
        } else { // Handle text/number columns
            const inputA = cellA.querySelector('input, select');
            const inputB = cellB.querySelector('input, select');
            // Get value from input if in edit mode, otherwise from the cell's text content.
            valueA = inputA ? inputA.value : cellA.textContent;
            valueB = inputB ? inputB.value : cellB.textContent;
        }

        // For 'Year' column, compare as numbers
        if (columnIndex === 2) {
            valueA = parseInt(valueA, 10);
            valueB = parseInt(valueB, 10);
        }

        const comparison = typeof valueA === 'boolean'
            ? valueA - valueB
            : collator.compare(valueA, valueB);

        return direction === 'asc' ? comparison : -comparison;
    });

    // Re-append rows in sorted order
    rows.forEach(row => tbody.appendChild(row));
}


/* ------------------------------ */
/* Helpers                        */
/* ------------------------------ */

function editableCell(initialValue, onChange, type = "text") {
    const input = document.createElement("input");
    input.value = initialValue;
    input.type = type;
    input.className = "border rounded px-2 py-1 w-full";

    let lastValue = initialValue;

    input.addEventListener("change", () => {
        if (input.value !== String(lastValue)) {
            lastValue = input.value;
            onChange(input.value);
        }
    });

    return input;
}

function wrapTd(el) {
    const td = document.createElement("td");
    td.appendChild(el);
    return td;
}
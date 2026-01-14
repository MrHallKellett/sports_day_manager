// static/scripts/ui/students_table.js

import { indexIssues } from "../domain/issues.js"
import { findMatchingEvent } from "../domain/events.js"

export function renderStudentsTable({
    students,
    events_by_name,
    participation,
    issues = []
    }) {
    const issueMap = indexIssues(issues);
    const eventNames = Object.keys(events_by_name);

    const headerRow = document.getElementById("student-header-row");
    headerRow.innerHTML = `
        <th class="sticky top-0 bg-gray-50 p-2">Name</th>
        <th class="sticky top-0 bg-gray-50 p-2">House</th>
        <th class="sticky top-0 bg-gray-50 p-2">Year</th>
        ${eventNames.map(n => `<th class="sticky top-0 bg-gray-50 p-2">${n}</th>`).join("")}
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
            </th>`).join("")}
    `;

    const tbody = document.getElementById("studentsTable");
    tbody.innerHTML = "";



    /* ✅ Existing students */
    for (const s of students) {
        tbody.appendChild(
            renderStudentRow(s, eventNames, events_by_name, participation, issueMap)
        );
    }

    filterRow.addEventListener("input", applyFilters);
}

/* ------------------------------ */
/* New student row                */
/* ------------------------------ */


/* ------------------------------ */
/* Existing student row           */
/* ------------------------------ */

function renderStudentRow(
    student,
    eventNames,
    events_by_name,
    participation,
    issueMap
) {
    const issue = issueMap[student.name];
    const tr = document.createElement("tr");

    const nameInput = editableCell(
        student.name,
        value => window.onUpdateStudent(student.id, { name: value })
    );

    const houseInput = editableCell(
        student.house,
        value => window.onUpdateStudent(student.id, { house: value })
    );

    const yearInput = editableCell(
        student.year,
        value => window.onUpdateStudent(
            student.id,
            { year: parseInt(value) }
        ),
        "number"
    );

    if (issue?.house_invalid) houseInput.classList.add("cell-warning");
    if (issue?.year_invalid) yearInput.classList.add("cell-warning");

    tr.appendChild(wrapTd(nameInput));
    tr.appendChild(wrapTd(houseInput));
    tr.appendChild(wrapTd(yearInput));

    // Event Checkboxes
    for (const eventName of eventNames) {
        const eventsForName = events_by_name[eventName];
        const matchedEvent = findMatchingEvent(eventsForName, student.year);

        const td = document.createElement("td");

        if (!matchedEvent) {
            td.textContent = "—";
        } else {
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.checked =
                participation[student.id]?.includes(matchedEvent.id);

            cb.addEventListener("change", () =>
                window.onToggleParticipation(
                    matchedEvent.id,
                    student.id,
                    cb.checked
                )
            );

            td.appendChild(cb);
        }

        tr.appendChild(td);
    }

    return tr;
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
        const name = row.cells[0].querySelector('input').value.toLowerCase();
        const house = row.cells[1].querySelector('input').value.toLowerCase();
        const year = row.cells[2].querySelector('input').value.toLowerCase();

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
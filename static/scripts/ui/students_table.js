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

    const thead = document
        .querySelector("#studentsTable")
        .closest("table")
        .querySelector("thead tr");

    thead.innerHTML = `
        <th>Name</th>
        <th>House</th>
        <th>Year</th>
        ${eventNames.map(n => `<th>${n}</th>`).join("")}
    `;

    const tbody = document.getElementById("studentsTable");
    tbody.innerHTML = "";



    /* ✅ Existing students */
    for (const s of students) {
        tbody.appendChild(
            renderStudentRow(s, eventNames, events_by_name, participation, issueMap)
        );
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
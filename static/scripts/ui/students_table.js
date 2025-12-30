// static/scripts/ui/students_table.js

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

    /* ✅ New student input row */
    tbody.appendChild(renderNewStudentRow(eventNames));

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

function renderNewStudentRow(eventNames) {
    const tr = document.createElement("tr");
    tr.classList.add("bg-gray-50");

    const nameInput = document.createElement("input");
    const houseInput = document.createElement("input");
    const yearInput = document.createElement("input");

    [nameInput, houseInput, yearInput].forEach(i => {
        i.className = "border rounded px-2 py-1 w-full";
    });

    yearInput.type = "number";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className =
        "bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700";

    saveBtn.addEventListener("click", async () => {
        const payload = {
            name: nameInput.value.trim(),
            house: houseInput.value.trim(),
            year: parseInt(yearInput.value)
        };

        if (!payload.name || !payload.house || !payload.year) {
            alert("Please fill in all fields");
            return;
        }

        await window.onCreateStudent(payload);
    });

    tr.innerHTML = `
        <td></td><td></td><td></td>
        ${eventNames.map(() => `<td></td>`).join("")}
    `;

    tr.children[0].appendChild(nameInput);
    tr.children[1].appendChild(houseInput);
    tr.children[2].appendChild(yearInput);
    tr.children[3].appendChild(saveBtn);

    return tr;
}

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
// static/scripts/domain/events.js

function findMatchingEvent(eventsForName, studentYear) {
    const studentGroups = yearToGroups(studentYear);
    return eventsForName.find(e =>
        studentGroups.has(String(e.year_group))
    );
}

function eventAllowsStudent(event, student) {
    const studentGroups = yearToGroups(student.year);
    return studentGroups.has(String(event.year_group));
}

function computeEventWarnings(events, allowedAgeCategories) {
    const warnings = {};        // event_id -> [messages]
    const seen = new Map();     // name::year_group -> event_id

    for (const e of events) {
        warnings[e.id] = [];

        if (!allowedAgeCategories.has(String(e.year_group))) {
            warnings[e.id].push(
                `Year group "${e.year_group}" is not configured for this sports day`
            );
        }

        const key = `${e.name}::${e.year_group}`;
        if (seen.has(key)) {
            warnings[e.id].push(
                "Duplicate event name and year group (matches another event)"
            );
            warnings[seen.get(key)].push(
                "Duplicate event name and year group (matches another event)"
            );
        } else {
            seen.set(key, e.id);
        }
    }

    return warnings;
}
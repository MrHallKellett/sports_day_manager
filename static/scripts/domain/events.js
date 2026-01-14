// static/scripts/domain/events.js

import { getApplicableGroups } from "./age_groups.js"

export function findMatchingEvent(eventsForName, studentYear) {
    const studentEligibleGroups = getApplicableGroups(studentYear);

    return eventsForName.find(event => {
        const eventApplicableGroups = getApplicableGroups(event.year_group);
        // Check for any intersection between the two sets.
        for (const group of studentEligibleGroups) {
            if (eventApplicableGroups.has(group)) return true;
        }
        return false;
    });
}

function eventAllowsStudent(event, student) {
    const studentGroups = getApplicableGroups(student.year);
    return studentGroups.has(String(event.year_group));
}

/**
 * Checks if an event's year group is valid against the configured settings,
 * correctly handling KS4 and KS5 groupings.
 * @param {string} eventYearGroup - The year group of the event (e.g., "10", "KS4").
 * @param {Set<string>} allowedAgeCategories - A set of allowed year groups from settings.
 * @returns {boolean} - True if the event's year group is allowed.
 */
function isEventYearGroupAllowed(eventYearGroup, allowedAgeCategories) {
    const yg = String(eventYearGroup);

    // Direct match (e.g., "7" is in {"7", "8"} or "KS4" is in {"KS4"})
    if (allowedAgeCategories.has(yg)) {
        return true;
    }

    // If event is for Year 10 or 11, check if KS4 is allowed
    if ((yg === "10" || yg === "11") && allowedAgeCategories.has("KS4")) {
        return true;
    }

    // If event is for Year 12 or 13, check if KS5 is allowed
    return (yg === "12" || yg === "13") && allowedAgeCategories.has("KS5");
}

export function computeEventWarnings(events, allowedAgeCategories) {
    const warnings = {};        // event_id -> [messages]
    const seen = new Map();     // name::year_group -> event_id

    for (const e of events) {
        warnings[e.id] = [];

        if (!isEventYearGroupAllowed(e.year_group, allowedAgeCategories)) {
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
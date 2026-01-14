// static/scripts/domain/staff_table.js

/**
 * Maps an array of event IDs to their corresponding names.
 * @param {number[]} ids - Array of event IDs.
 * @param {object[]} allEvents - The full list of event objects for the sports day.
 * @returns {string[]} An array of event names.
 */
export function getEventNamesFromIds(ids, allEvents) {
    return ids.map(id => allEvents.find(e => e.id === id)?.name || `Event ID ${id}`);
}


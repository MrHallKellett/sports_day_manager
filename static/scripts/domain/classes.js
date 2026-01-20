// static/scripts/domain/classes.js

/**
 * A helper to generate a list of all possible classes from sports day settings.
 * @param {object} settings - The sports day settings object.
 * @returns {string[]} - A sorted array of class names (e.g., "Y7 - HouseA").
 */
export function getClassesFromSettings(settings) {
    const classes = new Set();
    const years = new Set();
    (settings.year_groups || []).forEach(yg => {
        if (yg === "KS4") { years.add("10"); years.add("11"); }
        else if (yg === "KS5") { years.add("12"); years.add("13"); }
        else { years.add(String(yg)); }
    });

    (settings.houses || []).forEach(house => {
        years.forEach(year => {
            classes.add(`Y${year} - ${house}`);
        });
    });

    return Array.from(classes).sort();
}
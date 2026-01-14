export function ageCategoriesToYears(ageCategories) {
    console.log(ageCategories)
    years = new Set()
    for (const ac of ageCategories) {
        if (ac === "KS4") {
            years.add("10");
            years.add("11");
        }

        else if (ac === "KS5") {
            years.add("12");
            years.add("13");
        }

        else {
            years.add(String(ac))
        }
    }
    console.log(years)
    return years;
}



/**
 * Gets all applicable groups for a given year or key stage.
 * e.g., 11 -> {"11", "KS4"}
 * e.g., "KS4" -> {"10", "11", "KS4"}
 * @param {string|number} yearOrGroup - The year or key stage.
 * @returns {Set<string>} A set of applicable groups.
 */
export function getApplicableGroups(yearOrGroup) {
    const input = String(yearOrGroup);
    const groups = new Set([input]);
    
    if (input === "10" || input === "11" || input === "KS4") {
        groups.add("10").add("11").add("KS4");
    }
    if (input === "12" || input === "13" || input === "KS5") {
        groups.add("12").add("13").add("KS5");
    }
    return groups;
}
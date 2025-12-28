function ageCategoriesToYears(ageCategories) {
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



function yearToGroups(year) {
    const y = Number(year);
    const groups = new Set([String(y)]);

    if (y === 10 || y === 11) groups.add("KS4");
    if (y === 12 || y === 13) groups.add("KS5");

    return groups;
}

function isDigit(string) {
    // Ensure the input is a single character string first
    if (typeof string !== 'string') {
      return false;
    }
    for (const char of string) {
        const code = char.charCodeAt(0);
        if (!(code >= 48 && code <= 57)) {
            return false;
        }
    }
    return true;
  }
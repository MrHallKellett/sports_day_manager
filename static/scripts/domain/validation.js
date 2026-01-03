

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

export function validateEvent(data) {
    const errors = [];

    console.log("\n\n\n\n\n\n\n\n\n\n\n\n\n") 

    console.log(data)

    if (!data.name) {
        errors.push("Name cannot be blank.");
    }

    if (!data.year_group) {
        errors.push("Year Group cannot be blank.");
    }

    if (Number.isNaN(data.min_participants)) {
        errors.push("Min participants cannot be blank.");
    }

    if (Number.isNaN(data.max_participants)) {
        errors.push("Max participants cannot be blank.");
    }

    if (Number.isNaN(data.scoring_places)) {
        errors.push("Scoring cutoff N cannot be blank.");
    }

    if (Number.isNaN(data.points_1st)) {
        errors.push("Points for 1st cannot be blank.");
    }

    if (Number.isNaN(data.points_nth)) {
        errors.push("Points for Nth cannot be blank.");
    }

    if (data.min_participants < 2) {
        errors.push("Min participants must be at least 2.");
    }

    if (data.scoring_places > data.max_participants) {
        errors.push("Scoring cutoff N cannot be more than max participants.");
    }

    return errors;
}
import { validateEvent } from "../domain/validation.js";
import { showErrors } from "./feedback.js";

export function validateEventForm(data) {
    const errors = validateEvent(data);
    console.log(errors)
    
    if (errors.length > 0) {
        showErrors(errors);
        return false;
    }

    return true;
}


export function populateYearGroupSelect(yearGroups) {
    const yearGroupSelect = document.getElementById("year_group");
    
    // Clear existing options
    yearGroupSelect.innerHTML = "";
    
    // Populate with year groups from settings
    yearGroups.forEach(yearGroup => {
        const option = document.createElement("option");
        option.value = yearGroup;
        option.textContent = yearGroup;
        yearGroupSelect.appendChild(option);
    });
}

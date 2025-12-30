import { validateEvent } from "../domain/validation.js";
import { showValidationErrors } from "./validation_modal.js";

export function validateEventForm(data) {
    const errors = validateEvent(data);

    if (errors.length > 0) {
        showValidationErrors(errors);
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

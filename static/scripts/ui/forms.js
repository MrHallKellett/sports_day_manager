
function populateYearGroupSelect(yearGroups) {
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

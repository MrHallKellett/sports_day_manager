

async function loadConfiguredYearGroups(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load sports day settings");

    const settings = await res.json();
    return new Set(settings.year_groups || []);
}


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

function validateForm() {
    // Get all field values
    const name = document.getElementById("name").value.trim();
    const yearGroup = document.getElementById("year_group").value;
    const category = document.getElementById("category").value;
    const resultFormat = document.getElementById("result_format").value;
    const minParticipants = parseInt(document.getElementById("min").value);
    const maxParticipants = parseInt(document.getElementById("max").value);
    const scoringPlaces = parseInt(document.getElementById("cutoff").value);
    const points1st = parseInt(document.getElementById("p1").value);
    const pointsNth = parseInt(document.getElementById("pn").value);

    // Check for blank fields
    if (!name) {
        alert("Name cannot be blank.");
        return false;
    }
    if (!yearGroup) {
        alert("Year Group cannot be blank.");
        return false;
    }
    if (isNaN(minParticipants)) {
        alert("Min participants cannot be blank.");
        return false;
    }
    if (isNaN(maxParticipants)) {
        alert("Max participants cannot be blank.");
        return false;
    }
    if (isNaN(scoringPlaces)) {
        alert("Scoring cutoff N cannot be blank.");
        return false;
    }
    if (isNaN(points1st)) {
        alert("Points for 1st cannot be blank.");
        return false;
    }
    if (isNaN(pointsNth)) {
        alert("Points for Nth cannot be blank.");
        return false;
    }

    // Min participants must be at least 2
    if (minParticipants < 2) {
        alert("Min participants must be at least 2.");
        return false;
    }

    // Scoring places can't be more than max participants
    if (scoringPlaces > maxParticipants) {
        alert("Scoring cutoff N cannot be more than max participants.");
        return false;
    }

    return true;
}
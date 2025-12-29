async function loadConfiguredAgeCategories(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load sports day settings");

    const settings = await res.json();

    return new Set(
        (settings.year_groups || []).map(String)
    );
}

// static/scripts/api/sportsday.js

async function fetchSportsDay(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}`);
    if (!res.ok) throw new Error("Failed to load sports day");
    return res.json();
}

async function fetchSportsDaySettings(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json();
}

async function saveSportsDayStatus(sportsdayId, status) {
    return fetch(`/sportsdays/${sportsdayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
}

async function saveSportsDayRequirements(sportsdayId, payload) {
    return fetch(
        `/sportsdays/${sportsdayId}/settings`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        }
    );
}
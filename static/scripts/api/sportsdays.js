export async function loadConfiguredAgeCategories(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load sports day settings");

    const settings = await res.json();

    return new Set((settings.year_groups || []).map(String));
}

export async function fetchSportsDay(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}`);
    if (!res.ok) throw new Error("Failed to load sports day");
    return res.json();
}

export async function fetchSportsDaySettings(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json();
}

export async function updateSportsDayRequirements(sportsdayId, payload) {
    const res = await fetch("/sportsdays/${sportsdayId}/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({payload})
        }
    );
    if (!res.ok) throw new Error("Failed to save requirements");
    return res.json();
}
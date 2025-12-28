async function loadConfiguredAgeCategories(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/settings`);
    if (!res.ok) throw new Error("Failed to load sports day settings");

    const settings = await res.json();

    return new Set(
        (settings.year_groups || []).map(String)
    );
}
export function applyYearGroupSettings(settings) {
    if (!settings.year_groups) return;

    for (const yg of settings.year_groups) {
        if (yg === "KS4") {
            combineKS4.checked = true;
            y10.disabled = true;
            y11.disabled = true;
        } else if (yg === "KS5") {
            combineKS5.checked = true;
            y12.disabled = true;
            y13.disabled = true;
        } else {
            const cb = document.getElementById(`y${yg}`);
            if (cb) cb.checked = true;
        }
    }
}

export function loadParticipationSettings(settings) {
    document.getElementById("fieldMin").value = settings.field_min || 0;
    document.getElementById("trackMin").value = settings.track_min || 0;
    document.getElementById("overallMax").value = settings.overall_max || 0;
}

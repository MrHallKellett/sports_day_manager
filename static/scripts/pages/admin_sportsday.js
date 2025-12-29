// static/scripts/pages/admin_sportsday.js

let duplicateLoaded = false;

async function loadSportsDay(sportsdayId) {
    const [sportsday, settings] = await Promise.all([
        fetchSportsDay(sportsdayId),
        fetchSportsDaySettings(sportsdayId)
    ]);

    document.getElementById("title").textContent =
        `Sports Day ${sportsday.year}`;

    document.getElementById("status").value = sportsday.status;
    document.getElementById("createEventBtn").href =
        `/admin/events/new?sportsday=${sportsdayId}`;

    document.getElementById("fieldMin").value = settings.field_min || 0;
    document.getElementById("trackMin").value = settings.track_min || 0;
    document.getElementById("overallMax").value = settings.overall_max || 0;

    await loadEvents(sportsdayId);
    await loadStudents(sportsdayId);
}

async function loadEvents(sportsdayId) {
    const [events, allowedAgeCategories] = await Promise.all([
        fetchAllEvents(),
        loadConfiguredAgeCategories(sportsdayId)
    ]);

    const sportsDayEvents = events.filter(
        e => e.sports_day_id === sportsdayId
    );

    const warnings = computeEventWarnings(
        sportsDayEvents,
        allowedAgeCategories
    );

    renderEventsTable(sportsDayEvents, warnings, sportsdayId);
}

async function loadStudents(sportsdayId, issues = []) {
    const data = await fetchStudentsForSportsDay(sportsdayId);

    /* ✅ newest first */
    data.students.sort((a, b) => b.id - a.id);

    renderStudentsTable({ ...data, issues });
}

/* ------------------------------ */
/* Callbacks for UI               */
/* ------------------------------ */

window.onUpdateStudent = async (studentId, payload) => {
    const res = await updateStudent(studentId, payload);
    if (!res.ok) alert("Failed to update student");
};

window.onCreateStudent = async payload => {
    const res = await createStudent(sportsdayId, payload);

    if (!res.ok) {
        const msg = await res.text();
        alert(msg);
        return;
    }

    await loadStudents(sportsdayId);
};

/* existing callback */
window.onToggleParticipation = async (eventId, studentId, on) => {
    const res = await toggleParticipation(eventId, studentId, on);
    if (!res.ok) alert("Unable to update participation");
};
// static/scripts/api/events.js

async function fetchAllEvents() {
    const res = await fetch("/events");
    if (!res.ok) throw new Error("Failed to load events");
    return res.json();
}

async function deleteEventById(eventId) {
    return fetch(`/events/${eventId}`, { method: "DELETE" });
}

async function duplicateEvent(sportsdayId, sourceEventId) {
    return fetch(
        `/sportsdays/${sportsdayId}/events/duplicate`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_event_id: sourceEventId })
        }
    );
}

async function toggleParticipation(eventId, studentId, on) {
    const url = `/events/${eventId}/participants` +
        (on ? "" : `/${studentId}`);

    const opts = on
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ student_id: studentId })
        }
        : { method: "DELETE" };

    return fetch(url, opts);
}

async function fetchDuplicateOptions() {
    const res = await fetch("/events/duplicate-options");
    if (!res.ok) throw new Error("Failed to load duplicate options");
    return res.json();
}
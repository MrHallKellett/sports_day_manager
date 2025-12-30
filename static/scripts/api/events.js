// static/scripts/api/events.js

export async function fetchEvents(sportsDayId=null) {
    let route = "/events"
    if (sportsDayId != null) {
        route = `/sportsdays/${sportsDayId}/events`
    }
        
    const res = await fetch(route)
    if (!res.ok) throw new Error("Failed to load events");
    return res.json();
}

export async function fetchEvent(eventId) {
    const res = await fetch(`/events/${eventId}`);
    if (!res.ok) throw new Error(`Failed to load event id: ${eventId}`);
    return res.json();
}

export async function deleteEventById(eventId) {
    return fetch(`/events/${eventId}`, { method: "DELETE" });
}

export async function duplicateEvent(sportsdayId, sourceEventId) {
    return fetch(
        `/sportsdays/${sportsdayId}/events/duplicate`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source_event_id: sourceEventId })
        }
    );
}

export async function toggleParticipation(eventId, studentId, on) {
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

export async function fetchDuplicateOptions() {
    const res = await fetch("/events/duplicate-options");
    if (!res.ok) throw new Error("Failed to load duplicate options");
    return res.json();
}
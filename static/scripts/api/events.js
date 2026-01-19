// static/scripts/api/events.js

export async function fetchEvent(eventId) {
    const res = await fetch(`/events/${eventId}`);
    if (!res.ok) throw new Error('Failed to fetch event');
    return res.json();
}

export async function fetchEvents(sportsdayId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/events`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
}

export async function deleteEventById(eventId) {
    const res = await fetch(`/events/${eventId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete event');
    return res.json();
}

export async function updateEvent(eventId, payload) {
    const res = await fetch(`/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to update event');
    }
    return res.json();
}

export async function fetchDuplicateEventOptions() {
    const res = await fetch('/events/duplicate-options');
    if (!res.ok) throw new Error('Failed to fetch duplicate event options');
    return res.json();
}

export async function duplicateEvent(sportsdayId, sourceEventId) {
    const res = await fetch(`/sportsdays/${sportsdayId}/events/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_event_id: sourceEventId })
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to duplicate event');
    }
    return res.json();
}

export async function uploadEventsCsv(sportsdayId, file) {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/sportsdays/${sportsdayId}/events/upload`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Upload failed: ${error}`);
    }
    return res.json();
}

export async function toggleParticipation(eventId, studentId, on) {
    const url = `/events/${eventId}/participants`;
    if (on) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_id: studentId })
        });
    } else {
        return fetch(`${url}/${studentId}`, { method: 'DELETE' });
    }
}
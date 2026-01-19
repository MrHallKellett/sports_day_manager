// static/scripts/api/staff_table.js
import { apiClient } from './api_client.js';

export async function fetchStaff(sportsdayId) {
    const res = await apiClient(`/sportsdays/${sportsdayId}/staff`);
    if (!res.ok) throw new Error('Failed to fetch staff');
    return res.json();
}

export async function createStaff(sportsdayId, payload) {
    const res = await apiClient(`/sportsdays/${sportsdayId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || 'Failed to create staff');
    }
    return res.json();
}

export async function deleteStaff(assignmentId) {
    const res = await apiClient(`/staff/assignments/${assignmentId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete staff member');
    return res.json();
}

export async function uploadStaffCsv(sportsdayId, file) {
    const form = new FormData();
    form.append("file", file);

    const res = await apiClient(`/sportsdays/${sportsdayId}/staff/upload`, { method: "POST", body: form });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to upload staff: ${error}`);
    }
    return res.json();
}
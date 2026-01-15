// static/scripts/api/staff_table.js

export async function fetchStaff() {
    const res = await fetch('/staff');
    if (!res.ok) throw new Error('Failed to fetch staff');
    return res.json();
}

export async function createStaff(payload) {
    const res = await fetch('/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create staff: ${error}`);
    }
    return res.json();
}

export async function deleteStaff(staffId) {
    const res = await fetch(`/staff/${staffId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete staff member');
    return res.json();
}

export async function uploadStaffCsv(file) {
    const form = new FormData();
    form.append("file", file);

    const res = await fetch('/staff/upload', { method: "POST", body: form });
    if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to upload staff: ${error}`);
    }
    return res.json();
}
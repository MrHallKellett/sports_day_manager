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

// Note: updateStaff would go here for edit functionality
// static/scripts/ui/events_table.js

export function renderEventsTable(events, warnings, sportsdayId) {
    const rows = events.map(e => {
        const msgs = warnings[e.id] || [];
        const hasError = msgs.length > 0;
        const tooltip = msgs.join(" • ");

        const errorClass = hasError
            ? "bg-red-100 text-red-800 border border-red-300"
            : "";

        return `
            <tr class="border-b">
                <td class="py-2 px-2 ${errorClass}" title="${tooltip}">
                    ${e.name}
                </td>
                <td class="py-2 px-2 ${errorClass}" title="${tooltip}">
                    ${e.year_group}
                </td>
                <td class="py-2 px-2">
                    ${e.category}
                </td>
                <td class="py-2 px-2">
                    <a href="/admin/events/${e.id}/edit"
                       class="text-blue-600 hover:underline">
                        Edit
                    </a>
                    <button
                        data-event-id="${e.id}"
                        class="delete-event text-red-600 hover:underline ml-2">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    document.getElementById("eventsTable").innerHTML = rows;
}
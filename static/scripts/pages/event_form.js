import { populateYearGroupSelect, validateEventForm } from "../ui/form_validation.js";
import { loadConfiguredAgeCategories } from "../api/sportsdays.js";
import { displayExistingEventData, initCreate } from "../ui/event_form.js";
import { fetchEvent, updateEvent } from "../api/events.js";
import { getValue } from "./helpers.js"
import { showError } from "../ui/feedback.js";
import { apiClient } from "../api/api_client.js";


let mode = "create";
let eventId = null;

export async function loadEventForEdit(eventId) {
    const e = await fetchEvent(eventId);
    await initYearGroups(e.sports_day_id);
    await displayExistingEventData(e);
}


export async function initYearGroups(sportsDayId) {
    const yearGroups = await loadConfiguredAgeCategories(sportsDayId);
    populateYearGroupSelect(yearGroups);
}




function buildEventPayload() {
    return {
        name: getValue("name"),
        sex: getValue("sex"),
        year_group: getValue("year_group"),
        category: getValue("category"),
        result_format: getValue("result_format"),
        min_participants: parseInt(getValue("min")),
        max_participants: parseInt(getValue("max")),
        min_per_house: parseInt(getValue("min_house")),
        max_per_house: parseInt(getValue("max_house")),
        scoring_places: parseInt(getValue("cutoff")),
        points_1st: parseInt(getValue("p1")),
        points_nth: parseInt(getValue("pn"))
    };
}


/* -----------------------------
   Entry point (DOM-safe)
----------------------------- */

const form = document.getElementById("eventForm");
if (!form) {
    console.error("Event form not found. Script may have loaded before HTML was injected.");
} else {
    // This IIFE (Immediately Invoked Function Expression) is used to allow top-level await
    (async () => {
        form.onsubmit = async e => {
            e.preventDefault();

            const sportsDayId = getValue("sportsday");
            const payload = buildEventPayload();
            if (!validateEventForm(payload)) return;
            const url = mode === "create"
                ? `/events`
                : `/events/${eventId}`; // The update endpoint is not nested

            const method = mode === "create" ? "POST" : "PATCH";

            if (mode === "create") {
                payload.sports_day_id = parseInt(sportsDayId);
            }

            try {
                let data;
                if (mode === 'create') {
                    const res = await apiClient(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                    if (!res.ok) throw new Error(await res.text());
                    data = await res.json();
                    sessionStorage.setItem('toastMessage', `Event '${payload.name}' created successfully.`);
                } else { // mode === 'edit'
                    data = await updateEvent(eventId, payload);
                    if (data.removed_count > 0) {
                        const message = `Event '${payload.name}' updated. ${data.removed_count} student(s) were automatically removed due to the year group change.`;
                        sessionStorage.setItem('toastMessage', message);
                    }
                }
                sessionStorage.setItem('activeAdminTab', 'events'); // Set the active tab for the redirect
                window.location.href = `/admin/sportsday/${sportsDayId}`;
            } catch (error) {
                showError(`Failed to update event: ${error.message}`);
            }
        };

        if (window.location.pathname.includes("/edit")) {
            mode = "edit";
            eventId = parseInt(window.location.pathname.split("/").slice(-2)[0]);
            await loadEventForEdit(eventId);
        } else {
            const sportsDayId = new URLSearchParams(window.location.search).get("sportsday");
            await initYearGroups(sportsDayId);
            initCreate();
        }
    })();
}

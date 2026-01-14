import { populateYearGroupSelect, validateEventForm } from "../ui/form_validation.js";
import { loadConfiguredAgeCategories } from "../api/sportsdays.js";
import { displayExistingEventData, initCreate } from "../ui/event_form.js";
import { fetchEvent } from "../api/events.js";
import { getValue } from "./helpers.js"

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
                ? "/events"
                : `/events/${eventId}`;

            const method = mode === "create" ? "POST" : "PATCH";

            if (mode === "create") {
                payload.sports_day_id = parseInt(sportsDayId);
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                if (data.removed_count > 0) {
                    const message = `Event '${data.event_name}' updated. ${data.removed_count} student(s) were automatically removed due to the year group change.`;
                    sessionStorage.setItem('toastMessage', message);
                }
                window.location.href = `/admin/sportsday/${sportsDayId}`;
            } else {
                const errorText = await res.text();
                showError(`Failed to update event: ${errorText}`);
            }
        };

        if (window.location.pathname.includes("/edit")) {
            mode = "edit";
            eventId = parseInt(window.location.pathname.split("/").slice(-2)[0]);
            await loadEventForEdit(eventId);
        } else {
            initCreate();
        }
    })();
}

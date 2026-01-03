import { validateEventForm, populateYearGroupSelect } from "../ui/form_validation.js";
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

document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("eventForm");
    console.log("submitting")
    console.log("form found?", !!document.getElementById("eventForm"));
    if (!form) return;

    form.onsubmit = async e => {
        e.preventDefault();

        const sportsDayId = getValue("sportsday");
        const payload = buildEventPayload();
        console.log("Before cal")
        if (!validateEventForm(payload)) return;
        console.log("here")
        const url = mode === "create"
            ? "/events"
            : `/events/${eventId}`;

        const method = mode === "create" ? "POST" : "PATCH";

        if (mode === "create") {
            payload.sports_day_id = parseInt(sportsDayId);
        }

        await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        window.location.href = `/admin/sportsday/${sportsDayId}`;
    };

    if (window.location.pathname.includes("/edit")) {
        mode = "edit";
        eventId = parseInt(window.location.pathname.split("/").slice(-2)[0]);

        await loadEventForEdit(eventId);
    } else {
        initCreate();
    }
});


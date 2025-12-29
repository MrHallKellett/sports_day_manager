// static/scripts/pages/event_form.js

let mode = "create";
let eventId = null;

function getValue(id) {
    return document.getElementById(id).value;
}

function buildPayload() {
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

async function initYearGroups(sportsDayId) {
    const yearGroups = await loadConfiguredAgeCategories(sportsDayId);
    populateYearGroupSelect(yearGroups);
}

async function loadEventForEdit() {
    const e = await fetch(`/events/${eventId}`).then(r => r.json());

    document.getElementById("formTitle").textContent = "Edit Event";
    document.getElementById("submitBtn").textContent = "Save Changes";

    document.getElementById("sportsday").value = e.sports_day_id;

    await initYearGroups(e.sports_day_id);

    document.getElementById("name").value = e.name;
    document.getElementById("year_group").value = e.year_group;
    document.getElementById("category").value = e.category;
    document.getElementById("result_format").value = e.result_format;
    document.getElementById("min").value = e.min_participants;
    document.getElementById("max").value = e.max_participants;
    document.getElementById("min_house").value = e.min_per_house;
    document.getElementById("max_house").value = e.max_per_house;
    document.getElementById("cutoff").value = e.scoring_places;
    document.getElementById("p1").value = e.points_1st;
    document.getElementById("pn").value = e.points_nth;
}

async function initCreate() {
    document.getElementById("formTitle").textContent = "Create Event";
    document.getElementById("submitBtn").textContent = "Create Event";

    const sd = new URLSearchParams(window.location.search).get("sportsday");
    document.getElementById("sportsday").value = sd;

    await initYearGroups(sd);
}

document.getElementById("eventForm").onsubmit = async e => {
    e.preventDefault();

    if (!validateForm()) return;

    const sportsDayId = getValue("sportsday");
    const payload = buildPayload();

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

    alert(mode === "create" ? "Event created." : "Event updated.");
    window.location.href = `/admin/sportsday/${sportsDayId}`;
};

/* -----------------------------
   Entry point
----------------------------- */

(() => {
    if (window.location.pathname.includes("/edit")) {
        mode = "edit";
        eventId = parseInt(
            window.location.pathname.split("/").slice(-2)[0]
        );
        loadEventForEdit();
    } else {
        initCreate();
    }
})();
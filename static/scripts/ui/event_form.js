import { initYearGroups } from "../pages/event_form.js"




export function displayExistingEventData(e) {
    document.getElementById("formTitle").textContent = "Edit Event";
    document.getElementById("submitBtn").textContent = "Save Changes";

    document.getElementById("sportsday").value = e.sports_day_id;


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

export async function initCreate() {
    document.getElementById("formTitle").textContent = "Create Event";
    document.getElementById("submitBtn").textContent = "Create Event";

    const sd = new URLSearchParams(window.location.search).get("sportsday");
    document.getElementById("sportsday").value = sd;

    await initYearGroups(sd);
}



import { showToast } from "../ui/toast.js";
import { showError } from "../ui/feedback.js";

let student = null;
let settings = null;
let allEvents = [];
let myParticipants = [];

// -----------------------------
// DOM Elements
// -----------------------------
const studentNameEl = document.getElementById("studentName");
const studentYearEl = document.getElementById("studentYear");
const studentHouseEl = document.getElementById("studentHouse");
const fieldReqEl = document.getElementById("fieldReq");
const trackReqEl = document.getElementById("trackReq");
const overallReqEl = document.getElementById("overallReq");
const eventListEl = document.getElementById("eventList");

// -----------------------------
// LOAD STUDENT LOGIN
// -----------------------------
function loadStudent() {
    const saved = localStorage.getItem("student");
    if (!saved) {
        window.location.href = "/student/login";
        return false;
    }
    student = JSON.parse(saved);
    studentNameEl.textContent = student.name;
    studentYearEl.textContent = student.year_group;
    studentHouseEl.textContent = student.house;
    return true;
}

// -----------------------------
// LOGOUT
// -----------------------------
window.logout = function() {
    localStorage.removeItem("student");
    window.location.href = "/student/login";
}

// -----------------------------
// FETCH ALL DATA
// -----------------------------
async function loadData() {
    // Note: These endpoints don't seem to exist in routes.py, might need adjustment
    try {
        const sportsdayId = 1; // Assuming a default or logic to get the current one
        [settings, allEvents, myParticipants] = await Promise.all([
            fetch(`/sportsdays/${sportsdayId}/settings`).then(r => r.json()),
            fetch(`/sportsdays/${sportsdayId}/events`).then(r => r.json()),
            fetch(`/event_participants`).then(r => r.json()) // This is global, might need scoping
        ]);
        renderDashboard();
    } catch (err) {
        showError("Could not load dashboard data. Please try again later.");
        console.error(err);
    }
}

// -----------------------------
// RENDER EVERYTHING
// -----------------------------
function renderDashboard() {
    const myEventIDs = myParticipants
        .filter(p => p.student_id === student.id)
        .map(p => p.event_id);

    const myEvents = allEvents.filter(e => myEventIDs.includes(e.id));

    const myField = myEvents.filter(e => e.category === "field").length;
    const myTrack = myEvents.filter(e => e.category === "track").length;

    fieldReqEl.innerHTML = checkReq(myField >= settings.field_min,
        `Field: ${myField} / minimum ${settings.field_min}`);

    trackReqEl.innerHTML = checkReq(myTrack >= settings.track_min,
        `Track: ${myTrack} / minimum ${settings.track_min}`);

    overallReqEl.innerHTML = checkReq(myEvents.length <= settings.overall_max,
        `Overall: ${myEvents.length} / maximum ${settings.overall_max}`);

    renderEventList(myEventIDs);
}

function checkReq(ok, text) {
    return ok ? `<span class='req-ok'>${text}</span>`
              : `<span class='req-bad'>${text}</span>`;
}

// -----------------------------
// SHOW EVENTS
// -----------------------------
function renderEventList(myEventIDs) {
    eventListEl.innerHTML = "";
    allEvents.forEach(e => {
        const div = document.createElement("div");
        div.className = "event";

        const isMine = myEventIDs.includes(e.id);

        div.innerHTML = `
            <strong>${e.name}</strong><br>
            Year Group: ${e.year_group}<br>
            Category: ${e.category}<br>
            Participants: ${countEventParticipants(e.id)} / ${e.max_participants}<br>
            House Limit: min ${e.min_per_house}, max ${e.max_per_house}
        `;

        const btn = document.createElement("button");
        btn.className = "btn";
        btn.style.marginTop = "8px";

        if (isMine) {
            btn.textContent = "Remove Me";
            btn.classList.add("red");
            btn.onclick = () => unregister(e.id);
        } else {
            btn.textContent = "Join Event";
            btn.onclick = () => register(e);
        }

        div.appendChild(btn);
        eventListEl.appendChild(div);
    });
}

// -----------------------------
// COUNT EVENT PARTICIPANTS
// -----------------------------
function countEventParticipants(event_id) {
    return myParticipants.filter(p => p.event_id === event_id).length;
}

// -----------------------------
// REGISTER
// -----------------------------
async function register(event) {
    const myEventIDs = myParticipants
        .filter(p => p.student_id === student.id)
        .map(p => p.event_id);

    const myEvents = allEvents.filter(e => myEventIDs.includes(e.id));

    if (myEvents.length >= settings.overall_max) {
        showError("You have reached the overall event limit.");
        return;
    }

    const currentCount = countEventParticipants(event.id);
    if (currentCount >= event.max_participants) {
        showError("This event is full.");
        return;
    }

    // Note: House count logic depends on having all student data, which isn't loaded here.
    // This check may need to be handled by the backend.

    const res = await fetch(`/events/${event.id}/participants`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({student_id: student.id})
    });

    if (res.ok) {
        showToast("Successfully joined event!", "success");
        myParticipants = await fetch("/event_participants").then(r => r.json());
        renderDashboard();
    } else {
        const msg = await res.text();
        showError(msg);
    }
}

// -----------------------------
// UNREGISTER
// -----------------------------
async function unregister(event_id) {
    const res = await fetch(`/events/${event_id}/participants/${student.id}`, {
        method: "DELETE"
    });
    if (res.ok) {
        showToast("Removed from event", "info");
        myParticipants = await fetch("/event_participants").then(r => r.json());
        renderDashboard();
    } else {
        const msg = await res.text();
        showError(msg);
    }
}

// -----------------------------
// STARTUP
// -----------------------------
(async function(){
    if (loadStudent()) {
        await loadData();
    }
})();
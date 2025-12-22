from flask import Blueprint, request, jsonify, abort, send_from_directory
from database import db
from models import Event, SportsDay, Student, Settings, EventParticipant, SportsDaySetting

bp = Blueprint("routes", __name__)

from flask import Flask, request, jsonify, send_from_directory, abort
from flask_sqlalchemy import SQLAlchemy

import os



def ok(data): return jsonify(data), 200
def created(data): return jsonify(data), 201


# -----------------------------
# SPORTS DAY API
# -----------------------------

@bp.get("/sportsdays")
def list_sportsdays():
    sds = SportsDay.query.order_by(SportsDay.year.desc()).all()
    return ok([
        {"id": sd.id, "year": sd.year, "date": sd.date, "status": sd.status}
        for sd in sds
    ])


@bp.post("/sportsdays")
def create_sportsday():
    data = request.json
    sd = SportsDay(
        year=data["year"],
        date=data["date"],
        status="registering"
    )
    db.session.add(sd)
    db.session.commit()
    return created({"id": sd.id})


@bp.get("/sportsdays/<int:sid>")
def get_sportsday(sid):
    sd = SportsDay.query.get_or_404(sid)
    return ok({
        "id": sd.id,
        "year": sd.year,
        "date": sd.date,
        "status": sd.status
    })


@bp.patch("/sportsdays/<int:sid>")
def update_sportsday(sid):
    sd = SportsDay.query.get_or_404(sid)
    data = request.json
    if "status" in data:
        sd.status = data["status"]
    db.session.commit()
    return ok({"message": "updated"})


# -----------------------------
# SETTINGS API
# -----------------------------

def get_setting(key, default=None):
    s = Settings.query.get(key)
    return s.value if s else default


@bp.get("/sportsdays/<int:sd_id>/settings")
def get_settings(sd_id):
    keys = ["field_min", "track_min", "overall_max"]
    rows = SportsDaySetting.query.filter_by(sports_day_id=sd_id).all()
    lookup = {r.key: r.value for r in rows}

    return ok({
        k: int(lookup.get(k, 0))
        for k in keys
    })


@bp.patch("/sportsdays/<int:sd_id>/settings")
def update_settings(sd_id):
    data = request.get_json(force=True)

    for key, value in data.items():
        row = SportsDaySetting.query.filter_by(
            sports_day_id=sd_id,
            key=key
        ).first()

        if row is None:
            row = SportsDaySetting(
                sports_day_id=sd_id,
                key=key
            )
            db.session.add(row)

        row.value = value

    db.session.commit()
    return ok({"message": "settings updated"})

# -----------------------------
# EVENTS
# -----------------------------

@bp.get("/events")
def list_events():
    events = Event.query.all()
    return ok([
        {
            "id": e.id,
            "sports_day_id": e.sports_day_id,
            "name": e.name,
            "year_group": e.year_group,
            "category": e.category,
            "result_format": e.result_format,
            "min_participants": e.min_participants,
            "max_participants": e.max_participants,
            "scoring_places": e.scoring_places,
            "points_1st": e.points_1st,
            "points_nth": e.points_nth,
            "min_per_house": e.min_per_house,
            "max_per_house": e.max_per_house
        }
        for e in events
    ])
@bp.post("/events")
def create_event():
    d = request.json
    e = Event(
        sports_day_id=d["sports_day_id"],
        name=d["name"],
        year_group=d["year_group"],
        category=d["category"],
        result_format=d["result_format"],
        min_participants=d["min_participants"],
        max_participants=d["max_participants"],
        scoring_places=d["scoring_places"],
        points_1st=d["points_1st"],
        points_nth=d["points_nth"],
        min_per_house=d.get("min_per_house", 0),
        max_per_house=d.get("max_per_house", 999999),
    )
    db.session.add(e)
    db.session.commit()
    return created({"id": e.id})


@bp.patch("/events/<int:eid>")
def update_event(eid):
    e = Event.query.get_or_404(eid)
    for k,v in request.json.items():
        setattr(e, k, v)
    db.session.commit()
    return ok({"message":"event updated"})


@bp.get("/events/duplicate-options")
def duplicate_event_options():
    events = (
        db.session.query(Event, SportsDay)
        .join(SportsDay)
        .order_by(SportsDay.year.desc(), Event.name)
        .all()
    )

    return ok([
        {
            "event_id": e.id,
            "sports_day_id": sd.id,
            "sports_day_name": f"Sports Day {sd.year}",
            "event_name": e.name
        }
        for e, sd in events
    ])

@bp.post("/sportsdays/<int:sd_id>/events/duplicate")
def duplicate_event(sd_id):
    data = request.get_json(force=True)
    source_id = data["source_event_id"]

    source = Event.query.get_or_404(source_id)

    new_event = Event(
        sports_day_id=sd_id,
        name=source.name,
        year_group=source.year_group,
        category=source.category,
        result_format=source.result_format,

        min_participants=source.min_participants,
        max_participants=source.max_participants,
        scoring_places=source.scoring_places,
        points_1st=source.points_1st,
        points_nth=source.points_nth,
        min_per_house=source.min_per_house,
        max_per_house=source.max_per_house
    )

    db.session.add(new_event)
    db.session.commit()

    return ok({
        "message": "event duplicated",
        "new_event_id": new_event.id
    })

# -----------------------------
# EVENT PARTICIPANTS
# -----------------------------

@bp.get("/event_participants")
def all_participants():
    eps = EventParticipant.query.all()
    return ok([
        {"id": ep.id, "event_id": ep.event_id, "student_id": ep.student_id}
        for ep in eps
    ])


@bp.post("/events/<int:event_id>/participants")
def add_participant(event_id):
    event = Event.query.get_or_404(event_id)
    student_id = request.json["student_id"]
    student = Student.query.get_or_404(student_id)

    # Count participants
    current_participants = EventParticipant.query.filter_by(event_id=event_id).all()

    # Check max participants total
    if len(current_participants) >= event.max_participants:
        abort(400, "Event is full")

    # Check house quota
    house_count = sum(1 for p in current_participants
                      if Student.query.get(p.student_id).house == student.house)

    if house_count >= event.max_per_house:
        abort(400, "House limit reached for this event")

    ep = EventParticipant(event_id=event_id, student_id=student_id)
    db.session.add(ep)
    db.session.commit()
    return created({"id": ep.id})

@bp.delete("/events/<int:event_id>/participants/<int:student_id>")
def remove_participant(event_id, student_id):
    ep = EventParticipant.query.filter_by(event_id=event_id, student_id=student_id).first()
    if not ep:
        return abort(404)
    db.session.delete(ep)
    db.session.commit()
    return ok({"message": "removed"})


# -----------------------------
# STATIC FILE SERVING
# -----------------------------



@bp.get("/admin")
def admin_root():
    return send_from_directory("static", "admin.html")


@bp.get("/admin/sportsday/<int:sid>")
def admin_sportsday_page(sid):
    return send_from_directory("static", "admin_sportsday.html")


@bp.get("/admin/events/new")
def admin_event_new():
    return send_from_directory("static", "event_create.html")


@bp.get("/admin/events/<int:eid>/edit")
def admin_event_edit(eid):
    return send_from_directory("static", "event_edit.html")


@bp.get("/student/login")
def student_login_page():
    return send_from_directory("static", "student_login.html")


@bp.get("/student/dashboard")
def student_dashboard_page():
    return send_from_directory("static", "student_dashboard.html")


@bp.get("/")
def index():
    return "<h2>Sports Day Manager API is running</h2>"


# -----------------------------
# RUN
# -----------------------------


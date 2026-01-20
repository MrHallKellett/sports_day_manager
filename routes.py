from flask import Blueprint, request, jsonify, abort, send_from_directory
from database import db
from models import Event, SportsDay, SportsDayParticipant, Student, Settings, EventParticipant, SportsDaySetting, StaffMember, StaffAssignment, AuditLog, Result

from sqlalchemy import func
from datetime import datetime, timezone, timedelta


bp = Blueprint("routes", __name__)

from config import *
from utils import *
import random
import string
import csv
import io



def log_action(sports_day_id, user_info, action):
    log = AuditLog(
        sports_day_id=sports_day_id,
        user_info=user_info,
        action=action
    )
    db.session.add(log)

def get_sex_abbreviation(sex):
    if sex == 'male':
        return 'M'
    if sex == 'female':
        return 'F'
    return 'X' # For mixed

def get_user_info_from_request():
    """
    Determines the user identity for audit logging based on the request.
    Checks for a staff sign-in code in the headers first.
    """
    auth_code = request.headers.get('X-Auth-Code')
    if auth_code:
        assignment = StaffAssignment.query.filter_by(sign_in_code=auth_code).first()
        if assignment:
            # e.g., "Zonky (Admin)" or "Smith (Form Tutor)"
            roles = ', '.join(assignment.roles)
            return f"{assignment.staff_member.name} ({roles})"
    if auth_code == '999999':
        return "Super Admin"
    return "Unknown User" # Default if no staff code is found


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

def load_settings(sd_id):
    rows = SportsDaySetting.query.filter_by(sports_day_id=sd_id).all()
    return {r.key: r.value for r in rows}

def get_allowed_houses_and_years(sd_id):
    settings = load_settings(sd_id)

    houses = set(settings.get("houses", []))

    years = set()
    for yg in settings.get("year_groups", []):
        if yg == "KS4":
            years.update(["10", "11"])
        elif yg == "KS5":
            years.update(["12", "13"])
        else:
            years.add(str(yg))

    return houses, years


@bp.get("/sportsdays/<int:sd_id>/settings")
def get_settings(sd_id):
    rows = SportsDaySetting.query.filter_by(sports_day_id=sd_id).all()
    settings = {r.key: r.value for r in rows}

    return ok({
        "field_min": int(settings.get("field_min", 0)),
        "track_min": int(settings.get("track_min", 0)),
        "overall_max": int(settings.get("overall_max", 0)),
        "year_groups": settings.get("year_groups", []),
        "houses": settings.get("houses", [])
    })


@bp.patch("/sportsdays/<int:sd_id>/settings")
def update_settings(sd_id):
    data = request.get_json(force=True)
    auth_code = request.headers.get('X-Auth-Code')

    # Security Check
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to modify settings for this sports day.")

    for key, value in data.items():
        print(f"setting {key} to {value}")
        row = SportsDaySetting.query.filter_by(
            sports_day_id=sd_id,
            key=key
        ).first()

        if row is None:
            # This is a new setting being added, which is a change.
            row = SportsDaySetting(sports_day_id=sd_id, key=key, value=value)
            db.session.add(row)
            log_action(sd_id, get_user_info_from_request(), f"set new requirement '{key}' to '{value}'")
        elif row.value != value:
            # The setting exists and its value is different. This is a change.
            old_value = row.value
            row.value = value
            log_action(sd_id, get_user_info_from_request(), f"updated requirement '{key}' from '{old_value}' to '{value}'")
        # If row exists and row.value == value, do nothing.

    db.session.commit()
    return ok({"message": "settings updated"})

# -----------------------------
# EVENTS
# -----------------------------

def prep_event_payload(events):
    return ok([
        {
            "id": e.id,
            "sports_day_id": e.sports_day_id,
            "name": e.name,
            "sex": e.sex,
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


@bp.get("/sportsdays/<int:sd_id>/events")
def get_events_for_sportsday(sd_id):
    events = Event.query.filter_by(sports_day_id=sd_id).all()
    
    
    return prep_event_payload(events)

@bp.get("/events")
def list_events():
    events = Event.query.all()
    return prep_event_payload(events)

@bp.post("/events")
def create_event():
    d = request.json
    auth_code = request.headers.get('X-Auth-Code')
    sports_day_id = d.get("sports_day_id")
    if not is_authorized_for_sportsday(auth_code, sports_day_id):
        abort(403, "You are not authorized to create events for this sports day.")

    e = Event(
        sports_day_id=d["sports_day_id"],
        name=d["name"],
        sex=d["sex"],
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
    log_action(d["sports_day_id"], get_user_info_from_request(), f"created new event '{d['name']}' ({d['sex']}) for year group {d['year_group']}")
    db.session.commit()
    return created({"id": e.id})


@bp.get("/events/<int:eid>")
def get_event(eid):
    e = Event.query.get_or_404(eid)
    return ok(e.to_dict())

@bp.delete("/events/<int:eid>")
def delete_event(eid):
    e = Event.query.get_or_404(eid)
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, e.sports_day_id):
        abort(403, "You are not authorized to delete events for this sports day.")
    log_action(e.sports_day_id, get_user_info_from_request(), f"deleted event '{e.name}' (Y{e.year_group})")
    db.session.delete(e)
    db.session.commit()
    return ok({"message":"event deleted"})



@bp.patch("/events/<int:eid>")
def update_event(eid):
    e = Event.query.get_or_404(eid)
    data = request.json
    old_year_group = e.year_group
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, e.sports_day_id):
        abort(403, "You are not authorized to update events for this sports day.")

    for k,v in data.items():
        if k in ALLOWED_PATCH_FIELDS or k == 'sex':
            setattr(e, k, v)
            log_action(e.sports_day_id, get_user_info_from_request(), f"updated event '{e.name}', set {k} to '{v}'")

    # If the year group was changed, we need to remove any students
    # who are no longer eligible to participate.
    if "year_group" in data and data["year_group"] != old_year_group:
        new_year_group = data["year_group"]

        # Get all current participants for this event
        participants_to_check = EventParticipant.query.filter_by(event_id=eid).all()

        for participant in participants_to_check:
            student = Student.query.get(participant.student_id)
            if not student:
                continue

            # Check if student is still eligible
            student_year = student.year
            is_compatible = False
            if new_year_group == "KS4":
                is_compatible = student_year in [10, 11]
            elif new_year_group == "KS5":
                is_compatible = student_year in [12, 13]
            else:
                is_compatible = str(student_year) == new_year_group

            # If not compatible, remove them
            if not is_compatible:
                db.session.delete(participant)

    db.session.commit()
    return ok({"message":"event updated"})

@bp.post("/events/<int:event_id>/start")
def start_race(event_id):
    event = Event.query.get_or_404(event_id)
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, event.sports_day_id):
        abort(403, "You are not authorized to start this event.")

    participants = EventParticipant.query.filter_by(event_id=event_id).all()
    hkt = timezone(timedelta(hours=8))
    start_time = datetime.now(hkt)

    for p in participants:
        result = Result.query.filter_by(event_id=event_id, student_id=p.student_id).first()
        if not result:
            result = Result(event_id=event_id, student_id=p.student_id)
            db.session.add(result)
        result.start_time = start_time
        result.finish_time = None # Clear any previous finish time
        result.result_value = None

    log_action(event.sports_day_id, get_user_info_from_request(), f"started race for event '{event.name}' (Y{event.year_group})")
    db.session.commit()
    return ok({"message": "Race started for all participants."})

@bp.post("/events/<int:event_id>/students/<int:student_id>/finish")
def finish_race(event_id, student_id):
    event = Event.query.get_or_404(event_id)
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, event.sports_day_id):
        abort(403, "You are not authorized to finish this event for a student.")

    result = Result.query.filter_by(event_id=event_id, student_id=student_id).first()
    # If a result object doesn't exist (e.g., race started before this student was added), create it.
    hkt = timezone(timedelta(hours=8))
    if not result:
        # This case is for a student added late; their start time is now.
        result = Result(event_id=event_id, student_id=student_id, start_time=datetime.now(hkt))
        db.session.add(result)

    if not result.start_time:
        abort(400, "Cannot record finish time before start time is set.")

    # Ensure start_time is timezone-aware before calculation
    result.start_time = result.start_time.replace(tzinfo=hkt)

    result.finish_time = datetime.now(hkt)
    result.result_value = (result.finish_time - result.start_time).total_seconds()

    student = Student.query.get_or_404(student_id)
    log_action(event.sports_day_id, get_user_info_from_request(), f"recorded finish time for '{student.name}' in event '{event.name}'")
    db.session.commit()
    return ok({"message": "Finish time recorded."})

@bp.get("/events/<int:event_id>/results")
def get_event_results(event_id):
    event = Event.query.get_or_404(event_id)
    auth_code = request.args.get('code') # Staff code from query param

    # Authorization check
    is_authorized = False
    if auth_code == '999999':
        is_authorized = True
    else:
        assignment = StaffAssignment.query.filter_by(sign_in_code=auth_code).first()
        if assignment and event.sports_day_id == assignment.sports_day_id:
            is_authorized = True
    if not is_authorized:
        abort(403, "You are not authorized to view results for this event.")

    participants = Student.query.join(EventParticipant).filter(EventParticipant.event_id == event_id).all()
    results = Result.query.filter_by(event_id=event_id).all()
    results_map = {r.student_id: r for r in results}

    payload = []
    for p in participants:
        res = results_map.get(p.id)
        payload.append({
            "student": {"id": p.id, "name": p.name, "year": p.year, "house": p.house},
            "result": {
                "start_time": res.start_time.isoformat() if res and res.start_time else None,
                "finish_time": res.finish_time.isoformat() if res and res.finish_time else None,
                "result_value": res.result_value if res else None
            } if res else None
        })

    # Calculate house participation counts for this specific event
    event_participants = EventParticipant.query.filter_by(event_id=event_id).all()
    participant_student_ids = [ep.student_id for ep in event_participants]
    # We need student's sex for quota checks if the event is single-sex
    participant_students = Student.query.filter(Student.id.in_(participant_student_ids)).all() 
    
    house_counts_for_this_event = {}
    if event.sex == 'mixed':
        for student in participant_students:
            house_counts_for_this_event[student.house] = house_counts_for_this_event.get(student.house, 0) + 1
    else: # For single-sex events, the quota applies to that sex within the house
        for student in participant_students:
            if student.sex == event.sex:
                house_counts_for_this_event[student.house] = house_counts_for_this_event.get(student.house, 0) + 1

    return ok({
        "participants": payload,
        "result_format": event.result_format,
        "max_per_house": event.max_per_house,
        "house_participation_counts": house_counts_for_this_event
    })

@bp.patch("/participants/<int:sdid>")
def update_participants(sdid):
    pass

@bp.get("/participants/<int:sdid>")
def get_participants(sdid):
    pass



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
            "event_year_group": e.year_group, # Keep for filtering
            "event_name": f"Y{e.year_group}{get_sex_abbreviation(e.sex)} {e.name}" # Full name for display
        }
        for e, sd in events
    ])


@bp.post("/sportsdays/<int:sd_id>/events/duplicate")
def duplicate_event(sd_id):
    data = request.get_json(force=True)
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to duplicate events for this sports day.")
    source_id = data["source_event_id"]

    source = Event.query.get_or_404(source_id)

    new_event = Event(
        sports_day_id=sd_id,
        name=source.name + " copy",
        sex=source.sex,
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

@bp.post("/sportsdays/<int:sd_id>/events/upload")
def upload_events(sd_id):
    if "file" not in request.files:
        abort(400, "No file uploaded")
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(400, "No file uploaded")

    file = request.files["file"]
    try:
        text = file.stream.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        abort(400, "CSV file must be UTF-8 encoded")

    if not text.strip():
        abort(400, "CSV file is empty")

    stream = io.StringIO(text, newline=None)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        abort(400, "CSV file has no header row")

    headers = {h.strip().lower() for h in reader.fieldnames}
    required = {"name", "sex", "year_group", "category", "result_format"}
    if required - headers:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(required - headers))}")

    _, years_allowed = get_allowed_houses_and_years(sd_id)
    
    events_to_create = []
    errors = []
    seen_events = set()

    for row_num, raw in enumerate(reader, start=2):
        name = raw.get("name", "").strip()
        year_group = raw.get("year_group", "").strip()
        sex = raw.get("sex", "").strip().lower()

        # Validation 1: Duplicate name + year_group in the CSV
        if (name.lower(), year_group, sex) in seen_events:
            errors.append(f"Row {row_num}: Duplicate event '{name}' for year group '{year_group}' ({sex}) found in the file.")
            continue
        seen_events.add((name.lower(), year_group, sex))

        # Validation 2: Year group not allowed for this sports day
        if year_group not in years_allowed and year_group not in ["KS4", "KS5"]:
             # This check is a bit simplistic, a real one would check constituent years.
             errors.append(f"Row {row_num}: Year group '{year_group}' is not enabled for this sports day.")
             continue

        try:
            event_data = {
                "sports_day_id": sd_id,
                "name": name,
                "sex": sex,
                "year_group": year_group,
                "category": raw.get("category", "").strip(),
                "result_format": raw.get("result_format", "").strip(),
                "min_participants": int(raw.get("min_participants") or 0),
                "max_participants": int(raw.get("max_participants") or 999),
                "scoring_places": int(raw.get("scoring_places") or 0),
                "points_1st": int(raw.get("points_1st") or 0),
                "points_nth": int(raw.get("points_nth") or 0),
                "min_per_house": int(raw.get("min_per_house") or 0),
                "max_per_house": int(raw.get("max_per_house") or 999)
            }
            events_to_create.append(Event(**event_data))
        except (ValueError, TypeError) as e:
            errors.append(f"Row {row_num}: Invalid data - {e}")

    if errors:
        abort(400, "Validation failed: \n" + "\n".join(errors))

    db.session.bulk_save_objects(events_to_create)
    db.session.commit()

    return ok({"message": f"{len(events_to_create)} events created successfully."})

# -----------------------------
# STAFF
# -----------------------------

def generate_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

@bp.post("/staff/login")
def staff_login():
    data = request.get_json()
    code = data.get("code", "").upper()

    if code == "999999":
        return ok({"redirect": "/admin"})

    assignment = StaffAssignment.query.filter_by(sign_in_code=code).first()

    if not assignment:
        abort(401, "Invalid sign-in code.")

    # If the staff member has the 'Admin' role, redirect to the admin dashboard
    if "Admin" in assignment.roles:
        return ok({"redirect": f"/admin/sportsday/{assignment.sports_day_id}"})

    return ok({
        "redirect": f"/staff/dashboard?code={code}"
    })

@bp.get("/staff/dashboard-data")
def staff_dashboard_data():
    code = request.args.get("code")
    if not code:
        abort(400, "Missing sign-in code.")

    assignment = StaffAssignment.query.filter_by(sign_in_code=code).first_or_404("Invalid sign-in code.")
    sports_day = SportsDay.query.get_or_404(assignment.sports_day_id)

    assignment_dict = assignment.to_dict()

    # If the staff member is an Event Steward, resolve event IDs to names
    if "Event Steward" in assignment_dict.get("roles", []) and assignment_dict.get("assigned_events"):
        assigned_event_ids = assignment_dict["assigned_events"]
        events = Event.query.filter(Event.id.in_(assigned_event_ids)).order_by(Event.name).all()
        # Add the full event objects to the payload for the frontend to use
        assignment_dict["assigned_event_objects"] = [e.to_dict() for e in events]


    return ok({
        "assignment": assignment_dict,
        "sports_day": {
            "id": sports_day.id,
            "year": sports_day.year,
            "status": sports_day.status
        }
    })

@bp.get("/sportsdays/<int:sd_id>/history")
def get_history(sd_id):
    logs = AuditLog.query.filter_by(sports_day_id=sd_id).order_by(AuditLog.timestamp.desc()).all()
    return ok([log.to_dict() for log in logs])


@bp.get("/sportsdays/<int:sd_id>/staff")
def list_staff_for_sportsday(sd_id):
    assignments = StaffAssignment.query.filter_by(sports_day_id=sd_id).all()
    return ok([s.to_dict() for s in assignments])

@bp.post("/sportsdays/<int:sd_id>/staff")
def add_staff_to_sportsday(sd_id):
    data = request.json
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to add staff to this sports day.")
    name = data.get("name", "").strip()
    email = data.get("email", "").strip() or None
    if not name:
        abort(400, "Staff name is required.")

    # Find or create the global staff member
    staff_member = None
    if email:
        # Email is the most reliable unique identifier
        staff_member = StaffMember.query.filter(func.lower(StaffMember.email) == email.lower()).first()
        if staff_member and staff_member.name.lower() != name.lower():
            # Prevent creating a new staff member with an existing email but different name
            abort(409, f"Email {email} is already registered to {staff_member.name}.")

    if not staff_member:
        staff_member = StaffMember.query.filter(func.lower(StaffMember.name) == name.lower(), StaffMember.email == None).first()

    if not staff_member:
        staff_member = StaffMember(name=name, email=email)
        db.session.add(staff_member)
        db.session.flush() # To get staff_member.id
    elif email and not staff_member.email:
        # Add email to existing staff member
        staff_member.email = email

    # Check if this staff member is already assigned to this sports day
    existing_assignment = StaffAssignment.query.filter_by(staff_id=staff_member.id, sports_day_id=sd_id).first()
    if existing_assignment:
        return abort(409, f"{name} is already assigned to this sports day.")

    # The sign-in code is now part of the StaffMember, not the assignment.
    # We generate a unique one for each assignment.
    while True:
        code = generate_code()
        if not StaffAssignment.query.filter_by(sign_in_code=code).first():
            break

    new_assignment = StaffAssignment(
        staff_id=staff_member.id,
        sports_day_id=sd_id,
        roles=data.get("roles", []),
        assigned_classes=data.get("assigned_classes", []),
        assigned_events=data.get("assigned_events", []),
        sign_in_code=code
    )
    db.session.add(new_assignment)
    log_action(sd_id, get_user_info_from_request(), f"added new staff member '{name}' with roles: {', '.join(data.get('roles', []))}")
    db.session.commit()

    # We need to refresh the object to get the relationship-loaded data
    # for the to_dict() method to include name and email.
    db.session.refresh(new_assignment)

    return created(new_assignment.to_dict()) # Now includes name and email

@bp.patch("/staff/assignments/<int:assignment_id>")
def update_staff_assignment(assignment_id):
    assignment = StaffAssignment.query.get_or_404(assignment_id)
    user_info = get_user_info_from_request()
    data = request.json
    for key, value in data.items():
        if hasattr(assignment, key) and key not in ['id', 'staff_id', 'sports_day_id', 'sign_in_code']:
            old_value = getattr(assignment, key)
            if old_value != value:
                log_action(
                    assignment.sports_day_id,
                    user_info,
                    f"updated staff '{assignment.staff_member.name}': set {key} from '{old_value}' to '{value}'"
                )
                setattr(assignment, key, value)
    db.session.commit()
    return ok(assignment.to_dict())

@bp.delete("/staff/assignments/<int:assignment_id>")
def delete_staff_assignment(assignment_id):
    assignment = StaffAssignment.query.get_or_404(assignment_id)
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, assignment.sports_day_id):
        abort(403, "You are not authorized to delete staff from this sports day.")
    log_action(assignment.sports_day_id, get_user_info_from_request(), f"deleted staff assignment for '{assignment.staff_member.name}'")
    db.session.delete(assignment)
    db.session.commit()
    return ok({"message": "staff assignment deleted"})

@bp.post("/sportsdays/<int:sd_id>/staff/upload")
def upload_staff(sd_id):
    if "file" not in request.files:
        abort(400, "No file uploaded")
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to upload staff for this sports day.")

    file = request.files["file"]
    try:
        text = file.stream.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        abort(400, "CSV file must be UTF-8 encoded")

    if not text.strip():
        abort(400, "CSV file is empty")

    stream = io.StringIO(text, newline=None)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        abort(400, "CSV file has no header row")

    headers = {h.strip().lower() for h in reader.fieldnames}
    required = {"name"}
    if required - headers:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(required))}")

    # --- Pre-fetch data for validation ---
    # 1. Get all possible valid class names for this sports day
    all_houses, all_years = get_allowed_houses_and_years(sd_id)
    valid_class_names = {f"Y{year} {house}" for year in all_years for house in all_houses}
    
    # 2. Get all events and create a lookup map: "y<year_group> <event_name>" -> event_id
    all_events_for_map = Event.query.filter_by(sports_day_id=sd_id).all()
    event_name_to_id_map = {f"Y{e.year_group}{get_sex_abbreviation(e.sex)} {e.name}".lower(): e.id for e in all_events_for_map}

    created_count = 0
    skipped_count = 0
    updated_count = 0
    warnings = []
    for row_num, raw in enumerate(reader, start=2):
        name = raw.get("name", "").strip()
        email = raw.get("email", "").strip() or None
        if not name:
            continue # Skip empty rows

        # --- Parse and Validate Assignments from CSV ---
        parsed_classes = [c.strip() for c in raw.get('assigned_classes', '').split(',') if c.strip()]
        valid_classes = [c for c in parsed_classes if c in valid_class_names]
        invalid_classes = [c for c in parsed_classes if c not in valid_class_names]
        if invalid_classes:
            warnings.append(f"For staff '{name}', the following classes were invalid and ignored: {', '.join(invalid_classes)}")

        parsed_events_str = [e.strip() for e in raw.get('assigned_events', '').split(',') if e.strip()]
        valid_event_ids = [event_name_to_id_map[e.lower()] for e in parsed_events_str if e.lower() in event_name_to_id_map]
        invalid_events = [e for e in parsed_events_str if e.lower() not in event_name_to_id_map]
        if invalid_events:
            warnings.append(f"For staff '{name}', the following events were not found and ignored: {', '.join(invalid_events)}")

        # Find the global staff member, prioritizing email if it exists
        staff_member = StaffMember.query.filter(func.lower(StaffMember.name) == name.lower()).first()

        # Check if this staff member is already assigned to this sports day
        if staff_member:
            existing_assignment = StaffAssignment.query.filter_by(staff_id=staff_member.id, sports_day_id=sd_id).first()
            if existing_assignment:
                # UPDATE existing assignment
                updated = False
                if 'email' in raw and (raw['email'] or '') != (existing_assignment.staff_member.email or ''):
                    existing_assignment.staff_member.email = raw['email'].strip() or None
                    updated = True
                if 'roles' in raw:
                    new_roles = [r.strip() for r in raw['roles'].split(',') if r.strip()]
                    if set(new_roles) != set(existing_assignment.roles):
                        existing_assignment.roles = new_roles
                        updated = True
                if set(valid_classes) != set(existing_assignment.assigned_classes or []):
                    existing_assignment.assigned_classes = valid_classes
                    updated = True
                if set(valid_event_ids) != set(existing_assignment.assigned_events or []):
                    existing_assignment.assigned_events = valid_event_ids
                    updated = True
                
                if updated:
                    updated_count += 1
                    log_action(sd_id, get_user_info_from_request(), f"updated staff member '{name}' via CSV")
                continue # Skip to next row

        # Create the staff member if they don't exist globally
        if not staff_member:
            staff_member = StaffMember(name=name, email=email)
            db.session.add(staff_member)
            db.session.flush() # To get staff_member.id before creating assignment

        # Generate a unique sign-in code for this assignment
        while True:
            code = generate_code()
            if not StaffAssignment.query.filter_by(sign_in_code=code).first():
                break

        roles = [r.strip() for r in raw.get("roles", "").split(',') if r.strip()]
        new_assignment = StaffAssignment(
            staff_id=staff_member.id,
            sports_day_id=sd_id,
            roles=roles,
            assigned_classes=valid_classes,
            assigned_events=valid_event_ids,
            sign_in_code=code
        )
        db.session.add(new_assignment)
        log_action(sd_id, get_user_info_from_request(), f"added new staff member '{name}' with roles: {', '.join(roles)} via CSV")
        created_count += 1

    db.session.commit()

    return ok({"created_staff": created_count, "updated_staff": updated_count, "skipped_staff": skipped_count, "warnings": warnings})

# -----------------------------
# EVENT PARTICIPANTS
# -----------------------------

# -----------------------------
# STUDENTS
# -----------------------------

@bp.patch("/students/<int:student_id>")
def update_student(student_id):
    student = Student.query.get_or_404(student_id)
    data = request.get_json(force=True)
    auth_code = request.headers.get('X-Auth-Code')
    sports_day_id = request.headers.get('X-Sports-Day-ID')

    if not is_authorized_for_sportsday(auth_code, sports_day_id):
        abort(403, "You are not authorized to update students for this sports day.")

    allowed_fields = {"name", "house", "year", "sex"}

    for key, value in data.items():
        if key not in allowed_fields:
            abort(400, f"Field '{key}' cannot be updated")

        if key == "year":
            try:
                value = int(value)
            except ValueError:
                abort(400, "Year must be a number")

        setattr(student, key, value)

    log_action(request.headers.get('X-Sports-Day-ID'), get_user_info_from_request(), f"updated student '{student.name}' (Y{student.year}): set {key} to {value}")
    db.session.commit()

    return ok({
        "message": "student updated",
        "id": student.id
    })

@bp.post("/students")
def create_student():
    data = request.get_json(force=True)
    auth_code = request.headers.get('X-Auth-Code')
    sports_day_id = request.headers.get('X-Sports-Day-ID')

    if not is_authorized_for_sportsday(auth_code, sports_day_id):
        abort(403, "You are not authorized to create students for this sports day.")

    required = {"name", "house", "year", "sex"}
    missing = required - data.keys()
    if missing:
        abort(400, f"Missing required field(s): {', '.join(sorted(missing))}")

    try:
        year = int(data["year"])
    except ValueError:
        abort(400, "Year must be a number")

    name = data["name"].strip()
    house = data["house"].strip()
    sex = data["sex"].strip().lower()

    if not name or not house or not sex:
        abort(400, "Name and house cannot be empty")

    # -----------------------------
    # Global uniqueness check
    # -----------------------------
    existing = (
        db.session.query(Student)
        .filter(
            func.lower(Student.name) == name.lower(),
            Student.year == year
        )
        .one_or_none()
    )

    if existing:
        return ok({
            "message": "student already exists",
            "student": {
                "id": existing.id,
                "name": existing.name,
                "house": existing.house,
                "sex": existing.sex,
                "year": existing.year
            }
        })

    # -----------------------------
    # Create student
    # -----------------------------
    student = Student(
        name=name,
        house=house,
        sex=sex,
        year=year
    )

    db.session.add(student)
    log_action(request.headers.get('X-Sports-Day-ID'), get_user_info_from_request(), f"created new student '{name}' (Y{year}, {house})")
    db.session.commit()

    return created({
        "message": "student created",
        "student": {
            "id": student.id,
            "name": student.name,
            "house": student.house,
            "sex": student.sex,
            "year": student.year
        }
    })

@bp.post("/sportsdays/<int:sd_id>/students")
def add_student_to_sportsday(sd_id):
    data = request.get_json(force=True)
    auth_code = request.headers.get('X-Auth-Code')

    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to add students to this sports day.")

    if "student_id" not in data:
        abort(400, "Missing required field: student_id")

    student_id = data["student_id"]

    student = db.session.get(Student, student_id)
    if not student:
        abort(404, "Student not found")

    # -----------------------------
    # Validate against sports day settings
    # -----------------------------
    houses_allowed, years_allowed = get_allowed_houses_and_years(sd_id)

    student_groups = year_to_groups(student.year)

    if student.house not in houses_allowed:
        abort(400, f"House '{student.house}' is not configured for this sports day")

    if student_groups.isdisjoint(years_allowed):
        abort(400, f"Year '{student.year}' is not allowed for this sports day")

    # -----------------------------
    # Prevent duplicate participation
    # -----------------------------
    existing_link = (
        db.session.query(SportsDayParticipant)
        .filter_by(
            sports_day_id=sd_id,
            student_id=student.id
        )
        .one_or_none()
    )

    if existing_link:
        return ok({
            "message": "student already participating"
        })

    # -----------------------------
    # Link student to sports day
    # -----------------------------
    link = SportsDayParticipant(
        sports_day_id=sd_id,
        student_id=student.id
    )

    db.session.add(link)
    log_action(sd_id, get_user_info_from_request(), f"added existing student '{student.name}' to sports day")
    db.session.commit()

    return created({
        "message": "student added to sports day",
        "student_id": student.id
    })

@bp.delete("/sportsdays/<int:sd_id>/students/<int:student_id>")
def remove_student_from_sportsday(sd_id, student_id):
    link = SportsDayParticipant.query.filter_by(
        sports_day_id=sd_id,
        student_id=student_id
    ).first_or_404()
    auth_code = request.headers.get('X-Auth-Code')

    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to remove students from this sports day.")

    # Identify EventParticipant records to delete.
    # A bulk delete with a join can be problematic. This is a safer method.
    participant_records_to_delete = (
        db.session.query(EventParticipant.id)
        .join(Event, Event.id == EventParticipant.event_id)
        .filter(Event.sports_day_id == sd_id)
        .filter(EventParticipant.student_id == student_id)
    ).all()

    if participant_records_to_delete:
        ids_to_delete = [r.id for r in participant_records_to_delete]
        EventParticipant.query.filter(EventParticipant.id.in_(ids_to_delete)).delete(synchronize_session=False)

    db.session.delete(link)
    log_action(sd_id, get_user_info_from_request(), f"removed student '{Student.query.get(student_id).name}' from sports day")
    db.session.commit()
    return ok({"message": "student removed from sports day"})

@bp.post("/sportsdays/<int:sd_id>/students/upload")
def upload_students(sd_id):
    if "file" not in request.files:
        abort(400, "No file uploaded")
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, sd_id):
        abort(403, "You are not authorized to upload students for this sports day.")

    file = request.files["file"]

    try:
        text = file.stream.read().decode("utf-8-sig")
    except UnicodeDecodeError:
        abort(400, "CSV file must be UTF-8 encoded")

    if not text.strip():
        abort(400, "CSV file is empty")

    stream = io.StringIO(text, newline=None)
    reader = csv.DictReader(stream)

    if not reader.fieldnames:
        abort(400, "CSV file has no header row")

    headers = {h.strip().lower() for h in reader.fieldnames}
    required = {"name", "house", "year", "sex"}
    missing = required - headers

    if missing:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(missing))}")

    houses_allowed, years_allowed = get_allowed_houses_and_years(sd_id)

    created_count = 0
    linked_count = 0
    updated_count = 0
    skipped_count = 0
    issues = [] # For rows that couldn't be processed
    updates = [] # For rows that were successfully updated

    for row_num, raw in enumerate(reader, start=2):
        try:
            name = raw.get("name", "").strip()
            house = raw.get("house", "").strip()
            year = int(raw.get("year", "").strip())
            sex = raw.get("sex", "").strip().lower()
        except ValueError:
            abort(400, f"Invalid year value on row {row_num} (must be a number)")

        if not name:
            abort(400, f"Missing student name on row {row_num}")

        house_invalid = house not in houses_allowed
        student_groups = year_to_groups(year)
        year_invalid = student_groups.isdisjoint(years_allowed)

        if house_invalid or year_invalid:
            issues.append({
                "row": row_num,
                "name": name,
                "reason": f"House '{house}' or Year '{year}' is not configured for this sports day."
            })
            skipped_count += 1
            continue

        email = raw.get("email", "").strip() or None

        # -----------------------------
        # 1️⃣ Find or create student
        # -----------------------------
        student = Student.query.filter(
            func.lower(Student.name) == name.lower(),
            Student.year == year
        ).first()

        if not student:
            student = Student(
                name=name,
                house=house,
                year=year,
                sex=sex,
                email=email
            )
            db.session.add(student)
            db.session.flush()   # ✅ ensure student.id exists
            created_count += 1
        elif student.house != house:
            # Student exists, but house is different. Update it.
            old_house = student.house
            student.house = house
            updates.append({
                "name": name,
                "year": year,
                "change": f"House updated from '{old_house}' to '{house}'."
            })
            updated_count += 1
            log_action(sd_id, get_user_info_from_request(), f"updated student '{name}' via CSV: house changed to '{house}'")

        # -----------------------------
        # 2️⃣ Link student to sports day
        # -----------------------------
        exists = SportsDayParticipant.query.filter_by(
            sports_day_id=sd_id,
            student_id=student.id
        ).first()

        if not exists:
            db.session.add(
                SportsDayParticipant(
                    sports_day_id=sd_id,
                    student_id=student.id
                )
            )
            log_action(sd_id, get_user_info_from_request(), f"linked student '{student.name}' to sports day via CSV")
            linked_count += 1
        elif not student: # If student was not new and not updated, it was just skipped.
            skipped_count += 1

    db.session.commit()

    return ok({
        "created": created_count,
        "linked": linked_count,
        "updated": updated_count,
        "issues": issues,
        "updates": updates
    })


@bp.get("/sportsdays/<int:sd_id>/students")
def get_students(sd_id):
    # Students for this sports day only
    students = (
        Student.query
        .join(SportsDayParticipant)
        .filter(SportsDayParticipant.sports_day_id == sd_id)
        .all()
    )

    events = Event.query.filter_by(sports_day_id=sd_id).all()

    # Only participants for events in this sports day
    participants = (
        EventParticipant.query
        .join(Event)
        .filter(Event.sports_day_id == sd_id)
        .all()
    )

    # student_id -> set(event_id)
    participation = {}
    for p in participants:
        participation.setdefault(p.student_id, set()).add(p.event_id)

    # Fetch full event objects for all events students are participating in.
    # This is crucial for getting the category of events that might not be in the
    # current sports day's `events_by_name` list.
    all_participant_event_ids = {p.event_id for p in participants}
    all_participant_events = Event.query.filter(Event.id.in_(all_participant_event_ids)).all()
    events_by_id = {
        e.id: {"id": e.id, "category": e.category, "max_per_house": e.max_per_house}
        for e in all_participant_events
    }

    # Pre-calculate house participation counts for each event
    # event_id -> house_name -> count
    student_house_map = {s.id: s.house for s in students}
    event_participation_counts = {}
    for p in participants:
        event_id = p.event_id
        student_id = p.student_id
        house = student_house_map.get(student_id)

        if not house:
            continue

        if event_id not in event_participation_counts:
            event_participation_counts[event_id] = {}

        event_participation_counts[event_id][house] = event_participation_counts[event_id].get(house, 0) + 1

    events_by_name = {}

    for e in events:
        # Group events by their base name, collapsing year and sex variations.
        events_by_name.setdefault(e.name, []).append({
            "id": e.id,
            "year_group": str(e.year_group),
            "sex": e.sex,
            "category": e.category,
            "max_per_house": e.max_per_house
        })

    return ok({
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "house": s.house,
                "sex": s.sex,
                "year": s.year,
                "email": s.email
            }
            for s in students
        ],
        "events_by_name": events_by_name,
        "participation": {
            str(k): list(v) for k, v in participation.items()
        },
        "events_by_id": {str(k): v for k, v in events_by_id.items()},
        "event_participation_counts": {str(k): v for k, v in event_participation_counts.items()}
    })

@bp.get("/event_participants")
def all_participants():
    eps = EventParticipant.query.all()
    return ok([
        {"id": ep.id, "event_id": ep.event_id, "student_id": ep.student_id}
        for ep in eps
    ])

@bp.delete("/events/<int:event_id>/participants/<int:student_id>")
def remove_participant(event_id, student_id):
    # This now acts as a wrapper for the toggle logic, passing on=False
    return toggle_participation(event_id, student_id, on=False)

@bp.post("/events/<int:event_id>/participants/<int:student_id>/toggle")
def toggle_participation(event_id, student_id, on=None):
    event = Event.query.get_or_404(event_id)
    student = Student.query.get_or_404(student_id)
    user_info = get_user_info_from_request()
    if on is None: # If not passed directly, get from request body
        on = request.json.get("on", False)

    # Authorization check
    auth_code = request.headers.get('X-Auth-Code')
    if not is_authorized_for_sportsday(auth_code, event.sports_day_id):
        abort(403, "You are not authorized to modify participation for this event.")

    # Validate student sex against event sex
    if event.sex != 'mixed' and student.sex != event.sex:
        abort(400, f"This event is for {event.sex} participants only.")

    if on:
        # --- Add participant ---
        ep = EventParticipant(event_id=event_id, student_id=student_id)
        db.session.add(ep)
        log_action(event.sports_day_id, user_info, f"added '{student.name}' to event '{event.name}' (Y{event.year_group})")
        db.session.commit()

        # After committing, calculate the new counts to return to the frontend
        current_participants = EventParticipant.query.filter_by(event_id=event_id).all()
        participant_student_ids = {p.student_id for p in current_participants}
        participant_students = Student.query.filter(Student.id.in_(participant_student_ids)).all()

        total_participants = len(current_participants)
        house_count = sum(1 for s in participant_students if s.house == student.house)

        return created({
            "new_state": {
                "event_name": event.name,
                "student_house": student.house,
                "total_participants": total_participants,
                "house_participants": house_count,
                "max_participants": event.max_participants,
                "max_per_house": event.max_per_house
            }
        })
    else:
        # --- Remove participant ---
        ep = EventParticipant.query.filter_by(event_id=event_id, student_id=student_id).first()
        if not ep:
            return abort(404)

        db.session.delete(ep)
        log_action(event.sports_day_id, user_info, f"removed '{student.name}' from event '{event.name}' (Y{event.year_group})")
        db.session.commit()
        return ok({"message": "removed"})



@bp.post("/events/<int:event_id>/participants")
def add_participant(event_id):
    student_id = request.json["student_id"]
    # This now acts as a wrapper for the toggle logic, passing on=True
    return toggle_participation(event_id, student_id, on=True)

@bp.patch("/events/<int:event_id>/results/<int:student_id>")
def update_result(event_id, student_id):
    result = Result.query.filter_by(event_id=event_id, student_id=student_id).first()
    if not result:
        # If no result exists, create one. This is for field events primarily.
        result = Result(event_id=event_id, student_id=student_id)
        db.session.add(result)
    data = request.json
    # Simplified for now, can be expanded
    hkt = timezone(timedelta(hours=8))
    if 'start_time' in data and data['start_time']: # The incoming time is offset-aware (from JS .toISOString())
        utc_dt = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        result.start_time = utc_dt.astimezone(hkt) # Convert from UTC to HKT
    if 'finish_time' in data and data['finish_time']: # The incoming time is offset-aware
        utc_dt = datetime.fromisoformat(data['finish_time'].replace('Z', '+00:00'))
        result.finish_time = utc_dt.astimezone(hkt) # Convert from UTC to HKT
    if 'result_value' in data:
        result.result_value = data['result_value']
    
    if result.start_time and result.finish_time:
        # When loading from DB, datetimes are naive. We must make them aware before subtracting.
        if result.start_time.tzinfo is None:
            result.start_time = result.start_time.replace(tzinfo=hkt)
        if result.finish_time.tzinfo is None:
            result.finish_time = result.finish_time.replace(tzinfo=hkt)
        result.result_value = (result.finish_time - result.start_time).total_seconds()

    # Add logging for the result change
    if 'result_value' in data:
        student = Student.query.get_or_404(student_id)
        event = Event.query.get_or_404(event_id)
        log_action(event.sports_day_id, get_user_info_from_request(), f"recorded result '{data['result_value']}' for '{student.name}' in event '{event.name}' (Y{event.year_group})")

    db.session.commit()
    return ok({"message": "Result updated"})

# -----------------------------
# SECURITY HELPERS
# -----------------------------

def is_authorized_for_sportsday(auth_code, sports_day_id):
    if not auth_code:
        return False
    if auth_code == '999999':
        return True # Super admin can access anything

    assignment = StaffAssignment.query.filter_by(sign_in_code=auth_code).first()
    if not assignment:
        return False
    
    # Any staff member assigned to the sports day is authorized.
    return str(assignment.sports_day_id) == str(sports_day_id)


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

@bp.get("/staff/login")
def staff_login_page():
    return send_from_directory("static", "staff_login.html")


@bp.get("/student/dashboard")
def student_dashboard_page():
    return send_from_directory("static", "student_dashboard.html")

@bp.get("/staff/dashboard")
def staff_dashboard_page():
    return send_from_directory("static", "staff_dashboard.html")



@bp.get("/")
def index():
    return "<h2>Sports Day Manager API is running</h2>"


# -----------------------------
# RUN
# -----------------------------

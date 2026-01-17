from flask import Blueprint, request, jsonify, abort, send_from_directory
from database import db
from models import Event, SportsDay, SportsDayParticipant, Student, Settings, EventParticipant, SportsDaySetting, StaffMember, StaffAssignment

from sqlalchemy import func

bp = Blueprint("routes", __name__)

from config import *
from utils import *
import random
import string
import csv
import io


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

    for key, value in data.items():
        print(f"setting {key} to {value}")
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

def prep_event_payload(events):
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


@bp.get("/events/<int:eid>")
def get_event(eid):
    e = Event.query.get_or_404(eid)
    return ok(e.to_dict())

@bp.delete("/events/<int:eid>")
def delete_event(eid):
    e = Event.query.filter_by(id=eid).delete()
    db.session.commit()
    return ok({"message":"event deleted"})



@bp.patch("/events/<int:eid>")
def update_event(eid):
    e = Event.query.get_or_404(eid)
    data = request.json
    old_year_group = e.year_group

    for k,v in data.items():
        if k in ALLOWED_PATCH_FIELDS:
            setattr(e, k, v)

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
            "event_year_group": e.year_group,
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
        name=source.name + " copy",
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
    required = {"name", "year_group", "category", "result_format"}
    if required - headers:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(required - headers))}")

    _, years_allowed = get_allowed_houses_and_years(sd_id)
    
    events_to_create = []
    errors = []
    seen_events = set()

    for row_num, raw in enumerate(reader, start=2):
        name = raw.get("name", "").strip()
        year_group = raw.get("year_group", "").strip()

        # Validation 1: Duplicate name + year_group in the CSV
        if (name.lower(), year_group) in seen_events:
            errors.append(f"Row {row_num}: Duplicate event '{name}' for year group '{year_group}' found in the file.")
            continue
        seen_events.add((name.lower(), year_group))

        # Validation 2: Year group not allowed for this sports day
        if year_group not in years_allowed and year_group not in ["KS4", "KS5"]:
             # This check is a bit simplistic, a real one would check constituent years
             errors.append(f"Row {row_num}: Year group '{year_group}' is not enabled for this sports day.")
             continue

        try:
            event_data = {
                "sports_day_id": sd_id,
                "name": name,
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

    if code == "ADMIN7":
        return ok({"redirect": "/admin"})

    assignment = StaffAssignment.query.filter_by(sign_in_code=code).first()

    if not assignment:
        abort(401, "Invalid sign-in code.")

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

    return ok({
        "assignment": assignment.to_dict(),
        "sports_day": {
            "id": sports_day.id,
            "year": sports_day.year,
            "status": sports_day.status
        }
    })


@bp.get("/sportsdays/<int:sd_id>/staff")
def list_staff_for_sportsday(sd_id):
    assignments = StaffAssignment.query.filter_by(sports_day_id=sd_id).all()
    return ok([s.to_dict() for s in assignments])

@bp.post("/sportsdays/<int:sd_id>/staff")
def add_staff_to_sportsday(sd_id):
    data = request.json
    name = data.get("name", "").strip()
    email = data.get("email", "").strip() or None
    if not name:
        abort(400, "Staff name is required.")

    # Find or create the global staff member
    staff_member = None
    if email:
        staff_member = StaffMember.query.filter(func.lower(StaffMember.email) == email.lower()).first()
        if staff_member and staff_member.name.lower() != name.lower():
            # Prevent creating a new staff member with an existing email but different name
            abort(409, f"Email {email} is already registered to {staff_member.name}.")

    if not staff_member:
        staff_member = StaffMember.query.filter(func.lower(StaffMember.name) == name.lower()).first()

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
    db.session.commit()

    return created(new_assignment.to_dict())

@bp.patch("/staff/assignments/<int:assignment_id>")
def update_staff_assignment(assignment_id):
    assignment = StaffAssignment.query.get_or_404(assignment_id)
    data = request.json
    for key, value in data.items():
        if hasattr(assignment, key) and key not in ['id', 'staff_id', 'sports_day_id', 'sign_in_code']:
            setattr(assignment, key, value)
    db.session.commit()
    return ok(assignment.to_dict())

@bp.delete("/staff/assignments/<int:assignment_id>")
def delete_staff_assignment(assignment_id):
    assignment = StaffAssignment.query.get_or_404(assignment_id)
    db.session.delete(assignment)
    db.session.commit()
    return ok({"message": "staff assignment deleted"})

@bp.post("/sportsdays/<int:sd_id>/staff/upload")
def upload_staff(sd_id):
    if "file" not in request.files:
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
    required = {"name"}
    if required - headers:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(required))}")

    created_count = 0
    skipped_count = 0
    for row_num, raw in enumerate(reader, start=2):
        name = raw.get("name", "").strip()
        email = raw.get("email", "").strip() or None
        if not name:
            continue # Skip empty rows

        # Find or create the global staff member
        staff_member = StaffMember.query.filter(func.lower(StaffMember.name) == name.lower()).first()

        # Check if this staff member is already assigned to this sports day
        if staff_member:
            existing_assignment = StaffAssignment.query.filter_by(staff_id=staff_member.id, sports_day_id=sd_id).first()
            if existing_assignment:
                skipped_count += 1
                continue # Skip to next row

        # Create the staff member if they don't exist globally
        if not staff_member:
            staff_member = StaffMember(name=name, email=email)
            db.session.add(staff_member)
            db.session.flush() # To get staff_member.id before creating assignment
            created_count += 1
        else:
            skipped_count +=1

        # Generate a unique sign-in code for this assignment
        while True:
            code = generate_code()
            if not StaffAssignment.query.filter_by(sign_in_code=code).first():
                break

        new_assignment = StaffAssignment(
            staff_id=staff_member.id,
            sports_day_id=sd_id,
            roles=[r.strip() for r in raw.get("roles", "").split(',') if r.strip()],
            sign_in_code=code
        )
        db.session.add(new_assignment)

    db.session.commit()

    return ok({"created_staff": created_count, "skipped_staff": skipped_count})

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

    allowed_fields = {"name", "house", "year"}

    for key, value in data.items():
        if key not in allowed_fields:
            abort(400, f"Field '{key}' cannot be updated")

        if key == "year":
            try:
                value = int(value)
            except ValueError:
                abort(400, "Year must be a number")

        setattr(student, key, value)

    db.session.commit()

    return ok({
        "message": "student updated",
        "id": student.id
    })

@bp.post("/students")
def create_student():
    data = request.get_json(force=True)

    required = {"name", "house", "year"}
    missing = required - data.keys()
    if missing:
        abort(400, f"Missing required field(s): {', '.join(sorted(missing))}")

    try:
        year = int(data["year"])
    except ValueError:
        abort(400, "Year must be a number")

    name = data["name"].strip()
    house = data["house"].strip()

    if not name or not house:
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
                "year": existing.year
            }
        })

    # -----------------------------
    # Create student
    # -----------------------------
    student = Student(
        name=name,
        house=house,
        year=year
    )

    db.session.add(student)
    db.session.commit()

    return created({
        "message": "student created",
        "student": {
            "id": student.id,
            "name": student.name,
            "house": student.house,
            "year": student.year
        }
    })

@bp.post("/sportsdays/<int:sd_id>/students")
def add_student_to_sportsday(sd_id):
    data = request.get_json(force=True)

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
    db.session.commit()
    return ok({"message": "student removed from sports day"})

@bp.post("/sportsdays/<int:sd_id>/students/upload")
def upload_students(sd_id):
    if "file" not in request.files:
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
    required = {"name", "house", "year"}
    missing = required - headers

    if missing:
        abort(400, f"CSV is missing required column(s): {', '.join(sorted(missing))}")

    houses_allowed, years_allowed = get_allowed_houses_and_years(sd_id)

    issues = []
    created_students = 0
    linked_students = 0

    for row_num, raw in enumerate(reader, start=2):
        try:
            name = raw.get("name", "").strip()
            house = raw.get("house", "").strip()
            year = int(raw.get("year", "").strip())
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
                "house_invalid": house_invalid,
                "year_invalid": year_invalid
            })

        email = raw.get("email", "").strip() or None

        # -----------------------------
        # 1️⃣ Find or create student
        # -----------------------------
        student = None

        if email:
            student = Student.query.filter_by(email=email).first()

        if not student:
            student = Student.query.filter_by(
                name=name,
                year=year,
                house=house
            ).first()

        if not student:
            student = Student(
                name=name,
                house=house,
                year=year,
                email=email
            )
            db.session.add(student)
            db.session.flush()   # ✅ ensure student.id exists
            created_students += 1

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
            linked_students += 1

    db.session.commit()

    return ok({
        "created_students": created_students,
        "linked_students": linked_students,
        "issues": issues
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
        events_by_name.setdefault(e.name, []).append({
            "id": e.id,
            "year_group": str(e.year_group),
            "category": e.category,
            "max_per_house": e.max_per_house
        })

    return ok({
        "students": [
            {
                "id": s.id,
                "name": s.name,
                "house": s.house,
                "year": s.year,
                "email": s.email
            }
            for s in students
        ],
        "events_by_name": events_by_name,
        "participation": {
            str(k): list(v) for k, v in participation.items()
        },
        "events_by_id": events_by_id,
        "event_participation_counts": {str(k): v for k, v in event_participation_counts.items()}
    })

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

    ep = EventParticipant(event_id=event_id, student_id=student_id)
    db.session.add(ep)
    db.session.commit()

    # After committing, calculate the new counts to return to the frontend
    current_participants = EventParticipant.query.filter_by(event_id=event_id).all()
    participant_student_ids = {p.student_id for p in current_participants}
    participant_students = Student.query.filter(Student.id.in_(participant_student_ids)).all()

    total_participants = len(current_participants)
    house_count = sum(1 for s in participant_students if s.house == student.house)

    return created({
        "id": ep.id,
        "new_state": {
            "event_name": event.name,
            "student_house": student.house,
            "total_participants": total_participants,
            "house_participants": house_count,
            "max_participants": event.max_participants,
            "max_per_house": event.max_per_house
        }
    })

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

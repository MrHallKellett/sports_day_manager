from database import db
from sqlalchemy import JSON
from datetime import datetime
 
class Event(db.Model):
    __tablename__ = "events"
    id = db.Column(db.Integer, primary_key=True)
    sports_day_id = db.Column(db.Integer, db.ForeignKey("sports_day.id"))

    name = db.Column(db.String)
    year_group = db.Column(db.String)
    category = db.Column(db.String)   # track / field
    result_format = db.Column(db.String)

    min_participants = db.Column(db.Integer)
    max_participants = db.Column(db.Integer)

    scoring_places = db.Column(db.Integer)
    points_1st = db.Column(db.Integer)
    points_nth = db.Column(db.Integer)

    min_per_house = db.Column(db.Integer, default=0)
    max_per_house = db.Column(db.Integer, default=999999)

    participants = db.relationship("EventParticipant", backref="event", cascade="all, delete")

    def to_dict(self):
        return {
            "id": self.id,
            "sports_day_id": self.sports_day_id,
            "name": self.name,
            "year_group": self.year_group,
            "category": self.category,
            "result_format": self.result_format,
            "min_participants": self.min_participants,
            "max_participants": self.max_participants,
            "min_per_house": self.min_per_house,
            "max_per_house": self.max_per_house,
            "scoring_places": self.scoring_places,
            "points_1st": self.points_1st,
            "points_nth": self.points_nth,
        }

# -----------------------------
# MODELS
# -----------------------------

class SportsDay(db.Model):
    __tablename__ = "sports_day"
    id = db.Column(db.Integer, primary_key=True)
    year = db.Column(db.Integer, unique=True, nullable=False)
    date = db.Column(db.String, nullable=False)
    status = db.Column(db.String, default="registering")  # registering / recording

    events = db.relationship("Event", backref="sports_day", cascade="all, delete")
    participants = db.relationship(
        "SportsDayParticipant",
        backref="sports_day",
        cascade="all, delete-orphan"
    )

class Settings(db.Model):
    __tablename__ = "settings"
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String)

class SportsDaySetting(db.Model):
    __tablename__ = "sports_day_settings"
    key = db.Column(db.String, primary_key=True)
    value = db.Column(JSON)
    sports_day_id = db.Column(db.Integer, primary_key=True)


from sqlalchemy import Index, func

class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    house = db.Column(db.String, nullable=False)
    email = db.Column(db.String, nullable=True)

    sports_days = db.relationship(
        "SportsDayParticipant",
        backref="student",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "uq_student_name_year",
            func.lower(name),
            year,
            unique=True
        ),
    )


class EventParticipant(db.Model):
    __tablename__ = "event_participants"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)


class Result(db.Model):
    __tablename__ = "results"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False)
    result_value = db.Column(db.Float, nullable=False)

class SportsDayParticipant(db.Model):
    __tablename__ = "sports_day_participants"

    id = db.Column(db.Integer, primary_key=True)

    sports_day_id = db.Column(
        db.Integer,
        db.ForeignKey("sports_day.id"),
        nullable=False
    )

    student_id = db.Column(
        db.Integer,
        db.ForeignKey("students.id"),
        nullable=False
    )

    __table_args__ = (
        db.UniqueConstraint("sports_day_id", "student_id"),
    )

class StaffMember(db.Model):
    __tablename__ = "staff_members"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, nullable=True, unique=True)

    assignments = db.relationship("StaffAssignment", backref="staff_member", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id, 
            "name": self.name,
            "email": self.email
        }

class StaffAssignment(db.Model):
    __tablename__ = "staff_assignments"
    id = db.Column(db.Integer, primary_key=True)
    staff_id = db.Column(db.Integer, db.ForeignKey("staff_members.id"), nullable=False)
    sports_day_id = db.Column(db.Integer, db.ForeignKey("sports_day.id"), nullable=False)
    sign_in_code = db.Column(db.String, unique=True, nullable=False)
    roles = db.Column(JSON, nullable=False, default=[])
    assigned_classes = db.Column(JSON, nullable=True, default=[])
    assigned_events = db.Column(JSON, nullable=True, default=[])

    def to_dict(self):
        return {
            "id": self.id,
            "staff_id": self.staff_id,
            "sports_day_id": self.sports_day_id,
            "sign_in_code": self.sign_in_code,
            "roles": self.roles,
            "assigned_classes": self.assigned_classes,
            "assigned_events": self.assigned_events,
            "name": self.staff_member.name,
            "email": self.staff_member.email
        }

class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    sports_day_id = db.Column(db.Integer, db.ForeignKey("sports_day.id"), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    user_info = db.Column(db.String, nullable=False)
    action = db.Column(db.String, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat(),
            "user_info": self.user_info,
            "action": self.action
        }
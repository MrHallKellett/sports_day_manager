from database import db
 
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


class Settings(db.Model):
    __tablename__ = "settings"
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String)

class SportsDaySetting(db.Model):
    __tablename__ = "sports_day_settings"
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.String)
    sports_day_id = db.Column(db.Integer, primary_key=True)



class Student(db.Model):
    __tablename__ = "students"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    year_group = db.Column(db.String, nullable=False)
    house = db.Column(db.String, nullable=False)




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

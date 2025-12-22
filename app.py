from flask import Flask
from database import db
from routes import bp


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///sportsdaynew.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # import models so SQLAlchemy knows them
    from models import SportsDay, Event, Student

    with app.app_context():
        db.create_all()

    # import routes
    app.register_blueprint(bp)
    

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import random
import string

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

class Battalion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    companies = db.relationship('Company', backref='battalion', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Battalion {self.name}>'

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    battalion_id = db.Column(db.Integer, db.ForeignKey('battalion.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint on battalion_id and name combination
    __table_args__ = (db.UniqueConstraint('battalion_id', 'name', name='_battalion_company_uc'),)

    # Relationship
    conducts = db.relationship('Conduct', backref='company', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Company {self.name}>'

# Keep Unit model for backward compatibility but mark as deprecated
class Unit(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship - keeping for backward compatibility
    conducts_legacy = db.relationship('Conduct', foreign_keys='Conduct.unit_id', backref='unit', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Unit {self.name}>'

class Conduct(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    unit_id = db.Column(db.Integer, db.ForeignKey('unit.id'), nullable=True)  # Keep for backward compatibility
    name = db.Column(db.String(200), nullable=False)
    pin = db.Column(db.String(6), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity_at = db.Column(db.DateTime, default=datetime.utcnow)  # For 24-hour deactivation logic
    status = db.Column(db.String(20), default='active')  # active, inactive

    # Relationship
    users = db.relationship('User', backref='conduct', lazy=True, cascade='all, delete-orphan')
    sessions = db.relationship('Session', backref='conduct', lazy=True, cascade='all, delete-orphan')

    def generate_pin(self):
        """Generate a unique 6-digit PIN"""
        while True:
            pin = ''.join(random.choices(string.digits, k=6))
            if not Conduct.query.filter_by(pin=pin).first():
                self.pin = pin
                break

    def __repr__(self):
        return f'<Conduct {self.name}>'

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # trainer, conducting_body
    conduct_id = db.Column(db.Integer, db.ForeignKey('conduct.id'), nullable=False)
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Current session data (for active users)
    status = db.Column(db.String(20), default='idle')  # idle, working, resting
    zone = db.Column(db.String(20))
    start_time = db.Column(db.String(10))
    end_time = db.Column(db.String(10))
    location = db.Column(db.String(200))
    work_completed = db.Column(db.Boolean, default=False)
    pending_rest = db.Column(db.Boolean, default=False)
    most_stringent_zone = db.Column(db.String(20))  # Track harshest zone during current cycle

    # Relationship
    sessions = db.relationship('Session', backref='user', lazy=True, cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.name}>'

class Session(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    conduct_id = db.Column(db.Integer, db.ForeignKey('conduct.id'), nullable=False)
    zone = db.Column(db.String(20))
    start_time = db.Column(db.DateTime)
    end_time = db.Column(db.DateTime)
    status = db.Column(db.String(20))  # completed, interrupted, ongoing
    session_type = db.Column(db.String(20))  # work, rest
    location = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Session {self.user.name} - {self.zone}>'

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    conduct_id = db.Column(db.Integer, db.ForeignKey('conduct.id'), nullable=False)
    username = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    zone = db.Column(db.String(20))
    details = db.Column(db.Text)
    timestamp = db.Column(db.DateTime, nullable=False)  # Remove default, will be set explicitly

    def __repr__(self):
        return f'<ActivityLog {self.username} - {self.action}>'
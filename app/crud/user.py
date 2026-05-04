"""Чтение/создание пользователя и поля TOTP в БД."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


def get_by_email(db: Session, email: str) -> Optional[User]:
    return db.scalar(select(User).where(User.email == email))


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.get(User, user_id)


def create_user(db: Session, email: str, hashed_password: str) -> User:
    user = User(email=email, hashed_password=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def set_totp_secret(db: Session, user: User, secret: str) -> User:
    user.totp_secret = secret
    user.totp_enabled = False
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def enable_totp(db: Session, user: User) -> User:
    user.totp_enabled = True
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def disable_totp(db: Session, user: User) -> User:
    user.totp_enabled = False
    user.totp_secret = None
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

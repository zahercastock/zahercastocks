import datetime
import secrets
from typing import Optional
from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, UserSession

SESSION_COOKIE_NAME = "zaherca_session"
SESSION_DURATION_DAYS = 7

def create_user_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=SESSION_DURATION_DAYS)
    
    session = UserSession(
        token=token,
        user_id=user.id,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()
    return token

def delete_user_session(db: Session, token: str):
    if not token:
        return
    db.query(UserSession).filter(UserSession.token == token).delete()
    db.commit()

def get_user_by_session_token(db: Session, token: str) -> Optional[User]:
    if not token:
        return None
    
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if not session:
        return None
    
    if session.is_expired:
        db.delete(session)
        db.commit()
        return None
    
    user = session.user
    if not user or not user.is_active:
        return None
        
    return user

def extract_session_token(request: Request) -> Optional[str]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        return token
    
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()
        
    return None

def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    token = extract_session_token(request)
    if not token:
        return None
    return get_user_by_session_token(db, token)

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = get_current_user_optional(request, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No has iniciado sesión o tu sesión ha expirado."
        )
    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: solo la cuenta de Administrador puede realizar esta acción."
        )
    return current_user

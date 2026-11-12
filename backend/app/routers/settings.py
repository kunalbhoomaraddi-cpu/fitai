from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.ai.provider import ai_status
from app.database import get_db
from app.models import User
from app.schemas.auth import PasswordChangeIn, UserOut
from app.schemas.coach import SettingsIn
from app.models._mixins import utcnow
from app.services.auth_service import create_access_token, get_authenticated_user, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
def get_settings_(user: User = Depends(get_current_user)):
    return {"user": UserOut.model_validate(user).model_dump(), "unit_system": user.profile.unit_system if user.profile else "metric",
            "ai": ai_status(user.ai_provider_pref)}


@router.put("")
def update(body: SettingsIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.full_name:
        user.full_name = body.full_name.strip()
    if body.ai_provider_pref:
        user.ai_provider_pref = body.ai_provider_pref
    if body.unit_system and user.profile:
        user.profile.unit_system = body.unit_system
    db.commit()
    return get_settings_(user)


@router.post("/password")
def change_password(body: PasswordChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.is_demo:
        raise HTTPException(403, "The demo account's password can't be changed")
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    user.hashed_password = hash_password(body.new_password)
    user.password_changed_at = utcnow()  # signs out every other device
    db.commit()
    return {"detail": "Password changed. Other devices have been signed out.", "access_token": create_access_token(user.id)}


@router.delete("/account", status_code=204)
def delete_account(user: User = Depends(get_authenticated_user), db: Session = Depends(get_db)):
    db.delete(user)
    db.commit()

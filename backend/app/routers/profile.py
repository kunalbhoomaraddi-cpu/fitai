
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FitnessProfile, User, WeightRecord
from app.schemas.profile import CalcIn, ProfileIn, ProfileOut
from app.services import fitness_service
from app.services.auth_service import get_current_user, require_profile
from app.utils.clock import local_today

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileOut | None)
def get_profile(user: User = Depends(get_current_user)):
    return user.profile


@router.put("", response_model=ProfileOut)
def upsert_profile(body: ProfileIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"full_name"})
    if body.full_name:
        user.full_name = body.full_name
    p = user.profile
    if p is None:
        p = FitnessProfile(user_id=user.id, start_weight_kg=body.current_weight_kg, **data)
        db.add(p)
        db.add(WeightRecord(user_id=user.id, recorded_on=local_today(), weight_kg=body.current_weight_kg,
                            note="Starting weight"))
    else:
        for k, v in data.items():
            setattr(p, k, v)
    user.onboarding_complete = True
    db.commit()
    db.refresh(user)
    return user.profile


@router.get("/targets")
def targets(user: User = Depends(require_profile)):
    return fitness_service.profile_targets(user.profile)


@router.post("/calculate")
def calculate(body: CalcIn, _: User = Depends(get_current_user)):
    return fitness_service.full_calculation(body.weight_kg, body.height_cm, body.age, body.gender,
                                            body.activity_level, body.goal)

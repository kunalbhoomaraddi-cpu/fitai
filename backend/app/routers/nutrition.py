from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodEntry, User
from app.schemas.tracking import FoodEntryIn, FoodEntryOut, FoodEntryUpdate
from app.services import fitness_service, nutrition_service
from app.services.auth_service import get_current_user, require_profile
from app.utils.clock import local_today

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _own_entry(db: Session, user: User, entry_id: int) -> FoodEntry:
    e = db.get(FoodEntry, entry_id)
    if not e or e.user_id != user.id:  # user-specific isolation
        raise HTTPException(404, "Food entry not found")
    return e


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=80), _: User = Depends(get_current_user)):
    return nutrition_service.search_food(q)


@router.get("/day")
def day(d: date | None = Query(default=None, alias="date"), user: User = Depends(require_profile),
        db: Session = Depends(get_db)):
    d = d or local_today()
    entries = nutrition_service.day_entries(db, user.id, d)
    t = fitness_service.profile_targets(user.profile)
    return {**nutrition_service.summarize(entries), "date": d.isoformat(),
            "entries": [FoodEntryOut.model_validate(e).model_dump(mode="json") for e in entries],
            "targets": {"calories": t["calories"]["calorie_target"], "protein_g": t["macros"]["protein_g"],
                        "carbs_g": t["macros"]["carbs_g"], "fat_g": t["macros"]["fat_g"]}}


@router.post("/entries", response_model=FoodEntryOut, status_code=201)
def add_entry(body: FoodEntryIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = body.model_dump()
    data["eaten_on"] = data["eaten_on"] or local_today()
    e = FoodEntry(user_id=user.id, **data)
    db.add(e)
    db.commit()
    return e


@router.patch("/entries/{entry_id}", response_model=FoodEntryOut)
def update_entry(entry_id: int, body: FoodEntryUpdate, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    e = _own_entry(db, user, entry_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    return e


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_entry(db, user, entry_id))
    db.commit()


@router.get("/history")
def history(days: int = Query(14, ge=1, le=90), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return nutrition_service.history(db, user.id, days)

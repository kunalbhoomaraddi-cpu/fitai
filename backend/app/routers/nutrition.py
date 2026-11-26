from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import FoodEntry, SavedMeal, User
from app.schemas.lifestyle import WaterIn
from app.schemas.tracking import CopyMealIn, FoodEntryIn, FoodEntryOut, FoodEntryUpdate, LogSavedMealIn, SavedMealIn
from app.services import fitness_service, lifestyle_service, meal_photo_service, nutrition_service, photo_service
from app.services.auth_service import get_current_user, require_profile
from app.utils.clock import local_today
from app.utils.ratelimit import ai_rate_limit

router = APIRouter(prefix="/nutrition", tags=["nutrition"])


def _own_entry(db: Session, user: User, entry_id: int) -> FoodEntry:
    e = db.get(FoodEntry, entry_id)
    if not e or e.user_id != user.id:  # user-specific isolation
        raise HTTPException(404, "Food entry not found")
    return e


@router.get("/search")
def search(q: str = Query(min_length=2, max_length=80), _: User = Depends(get_current_user)):
    return nutrition_service.search_food(q)


@router.get("/barcode/{code}")
def barcode(code: str = Path(pattern=r"^\d{8,14}$"), _: User = Depends(get_current_user)):
    """Packaged food by barcode (EAN-8, UPC-A, EAN-13, GTIN-14) from Open Food Facts."""
    return nutrition_service.lookup_barcode(code)


@router.get("/water")
def water(d: date | None = Query(default=None, alias="date"), user: User = Depends(require_profile),
          db: Session = Depends(get_db)):
    """Water drunk on a day, with a goal of about 35 ml per kg of body weight."""
    return lifestyle_service.water_day(db, user, d or local_today())


@router.post("/water")
def add_water(body: WaterIn, user: User = Depends(require_profile), db: Session = Depends(get_db)):
    d = body.date or local_today()
    if d > local_today():
        raise HTTPException(400, "Water can't be logged for a future day")
    return lifestyle_service.add_water(db, user, d, body.ml)


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


@router.post("/photo")
async def analyze_meal_photo(file: UploadFile = File(...), user: User = Depends(ai_rate_limit)):
    """Snap your meal: identify foods and portions in a photo. Nothing is saved; the user reviews and adds."""
    raw = await file.read(photo_service.MAX_UPLOAD_BYTES + 1)
    return await run_in_threadpool(meal_photo_service.analyze, raw, user.id, user.ai_provider_pref, user.is_demo)


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


@router.get("/recent")
def recent(limit: int = Query(8, ge=1, le=20), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """The user's most recently logged distinct foods, newest first, for one-tap re-logging."""
    rows = db.scalars(select(FoodEntry).where(FoodEntry.user_id == user.id)
                      .order_by(FoodEntry.eaten_on.desc(), FoodEntry.id.desc()).limit(200))
    seen, out = set(), []
    for e in rows:
        key = e.name.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"name": e.name, "quantity_g": e.quantity_g, "calories": e.calories, "protein_g": e.protein_g,
                    "carbs_g": e.carbs_g, "fat_g": e.fat_g, "source": e.source, "source_id": e.source_id, "meal": e.meal})
        if len(out) >= limit:
            break
    return out


# --------------------------------------------------------------------------- copy & saved meals
_ITEM_FIELDS = ("name", "quantity_g", "calories", "protein_g", "carbs_g", "fat_g", "source", "source_id")
MAX_SAVED_MEALS = 30
MAX_ITEMS = 25


def _meal_entries(db: Session, user_id: int, d, meal: str) -> list[FoodEntry]:
    return list(db.scalars(select(FoodEntry).where(FoodEntry.user_id == user_id, FoodEntry.eaten_on == d, FoodEntry.meal == meal)
                           .order_by(FoodEntry.id)))


def _add_items(db: Session, user_id: int, d, meal: str, items: list[dict]) -> int:
    for it in items[:MAX_ITEMS]:
        db.add(FoodEntry(user_id=user_id, eaten_on=d, meal=meal, **{k: it.get(k) for k in _ITEM_FIELDS}))
    db.commit()
    return min(len(items), MAX_ITEMS)


def _saved_out(m: SavedMeal) -> dict:
    tot = {k: round(sum(float(i.get(k) or 0) for i in m.items), 1) for k in ("calories", "protein_g", "carbs_g", "fat_g")}
    tot["calories"] = round(tot["calories"])
    return {"id": m.id, "name": m.name, "meal": m.meal, "items": m.items, "totals": tot}


@router.post("/copy")
def copy_meal(body: CopyMealIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """'Same as yesterday': copy one meal's foods to another day."""
    src = _meal_entries(db, user.id, body.from_date, body.meal)
    if not src:
        raise HTTPException(400, "Nothing was logged for that meal on that day.")
    n = _add_items(db, user.id, body.to_date, body.to_meal or body.meal, [{k: getattr(e, k) for k in _ITEM_FIELDS} for e in src])
    return {"copied": n}


@router.get("/saved-meals")
def list_saved(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(SavedMeal).where(SavedMeal.user_id == user.id).order_by(SavedMeal.name))
    return [_saved_out(m) for m in rows]


@router.post("/saved-meals", status_code=201)
def save_meal(body: SavedMealIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    src = _meal_entries(db, user.id, body.eaten_on, body.meal)
    if not src:
        raise HTTPException(400, "Log some food for this meal first, then save it.")
    if db.scalar(select(func.count()).select_from(SavedMeal).where(SavedMeal.user_id == user.id)) >= MAX_SAVED_MEALS:
        raise HTTPException(400, f"You can keep up to {MAX_SAVED_MEALS} saved meals. Delete one to save another.")
    m = SavedMeal(user_id=user.id, name=body.name.strip(), meal=body.meal,
                  items=[{k: getattr(e, k) for k in _ITEM_FIELDS} for e in src[:MAX_ITEMS]])
    db.add(m)
    db.commit()
    return _saved_out(m)


def _own_saved(db: Session, user: User, mid: int) -> SavedMeal:
    m = db.get(SavedMeal, mid)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Saved meal not found")
    return m


@router.post("/saved-meals/{mid}/log")
def log_saved(mid: int, body: LogSavedMealIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    m = _own_saved(db, user, mid)
    n = _add_items(db, user.id, body.eaten_on or local_today(), body.meal or m.meal, m.items)
    return {"logged": n, **_saved_out(m)}


@router.delete("/saved-meals/{mid}", status_code=204)
def delete_saved(mid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_own_saved(db, user, mid))
    db.commit()

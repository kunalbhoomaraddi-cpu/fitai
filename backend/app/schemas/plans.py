from typing import Literal

from pydantic import BaseModel, Field


class DietPlanIn(BaseModel):
    calorie_target: int | None = Field(default=None, ge=1200, le=5000)
    protein_g: int | None = Field(default=None, ge=30, le=400)
    carbs_g: int | None = Field(default=None, ge=30, le=800)
    fat_g: int | None = Field(default=None, ge=20, le=300)
    diet_preference: Literal["vegetarian", "vegan", "eggetarian", "non_vegetarian", "custom"] | None = None
    food_restrictions: list[str] | None = None
    meals_per_day: Literal[3, 4, 5] = 4
    budget: Literal["low", "medium", "high"] = "medium"
    food_preferences: str | None = Field(default=None, max_length=300)
    use_ai: bool = True


class RegenerateMealIn(BaseModel):
    slot: int = Field(ge=0, le=10)


class ReplaceItemIn(BaseModel):
    slot: int = Field(ge=0, le=10)
    item_index: int = Field(ge=0, le=20)


class MealCompleteIn(BaseModel):
    slot: int = Field(ge=0, le=10)
    completed: bool = True
    log_to_tracker: bool = True


class WorkoutPlanIn(BaseModel):
    goal: Literal["weight_loss", "muscle_gain", "recomposition", "general_fitness", "maintenance"] | None = None
    experience: Literal["beginner", "intermediate", "advanced"] | None = None
    days_per_week: int | None = Field(default=None, ge=1, le=6)
    equipment: list[str] | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=120)
    split: Literal["auto", "full_body", "upper_lower", "push_pull_legs", "beginner", "muscle_building", "fat_loss", "custom"] = "auto"
    target_muscles: list[str] = Field(default_factory=list)
    recovery: Literal["standard", "extra_rest", "active_recovery"] = "standard"
    use_ai: bool = True


class StartWorkoutIn(BaseModel):
    plan_id: int | None = None
    day_index: int = Field(ge=0, le=7, default=0)


class UpdateSessionIn(BaseModel):
    exercises: list[dict] | None = None
    status: Literal["in_progress", "completed", "abandoned"] | None = None

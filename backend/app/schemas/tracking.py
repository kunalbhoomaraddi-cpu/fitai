from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

MealType = Literal["breakfast", "lunch", "snack", "dinner"]


class FoodEntryIn(BaseModel):
    eaten_on: date | None = None
    meal: MealType
    name: str = Field(min_length=1, max_length=200)
    quantity_g: float = Field(gt=0, le=5000)
    calories: float = Field(ge=0, le=10000)
    protein_g: float = Field(ge=0, le=1000)
    carbs_g: float = Field(ge=0, le=1000)
    fat_g: float = Field(ge=0, le=1000)
    source: Literal["open_food_facts", "reference", "custom", "meal_plan"] = "custom"
    source_id: str | None = Field(default=None, max_length=64)


class FoodEntryUpdate(BaseModel):
    meal: MealType | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    quantity_g: float | None = Field(default=None, gt=0, le=5000)
    calories: float | None = Field(default=None, ge=0, le=10000)
    protein_g: float | None = Field(default=None, ge=0, le=1000)
    carbs_g: float | None = Field(default=None, ge=0, le=1000)
    fat_g: float | None = Field(default=None, ge=0, le=1000)


class FoodEntryOut(FoodEntryIn):
    id: int
    eaten_on: date
    model_config = {"from_attributes": True}


class WeightIn(BaseModel):
    recorded_on: date | None = None
    weight_kg: float = Field(gt=30, lt=300)
    note: str | None = Field(default=None, max_length=255)


class WeightOut(BaseModel):
    id: int
    recorded_on: date
    weight_kg: float
    note: str | None
    model_config = {"from_attributes": True}


class MeasurementIn(BaseModel):
    recorded_on: date | None = None
    waist_cm: float | None = Field(default=None, gt=30, lt=250)
    chest_cm: float | None = Field(default=None, gt=30, lt=250)
    hips_cm: float | None = Field(default=None, gt=30, lt=250)
    arm_cm: float | None = Field(default=None, gt=10, lt=100)
    thigh_cm: float | None = Field(default=None, gt=20, lt=150)


class MeasurementOut(MeasurementIn):
    id: int
    recorded_on: date
    model_config = {"from_attributes": True}


class TargetWeightIn(BaseModel):
    target_weight_kg: float = Field(gt=30, lt=300)

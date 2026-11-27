import datetime as dt
from datetime import date

from pydantic import BaseModel, Field, model_validator


class WaterIn(BaseModel):
    ml: int = Field(ge=-2000, le=2000, description="Amount to add (negative to undo)")
    date: dt.date | None = None


class BreakIn(BaseModel):
    kind: str = Field(pattern="^(travel|festival)$")
    start_on: date
    end_on: date
    note: str | None = Field(default=None, max_length=80)

    @model_validator(mode="after")
    def _range(self):
        if self.end_on < self.start_on:
            raise ValueError("The break must end on or after its first day")
        if (self.end_on - self.start_on).days + 1 > 21:
            raise ValueError("A break can last up to 21 days")
        return self


class MealTextIn(BaseModel):
    text: str = Field(min_length=2, max_length=500)


class AdaptiveIn(BaseModel):
    enabled: bool


class SwapIn(BaseModel):
    index: int = Field(ge=0, le=30)
    exercise_id: str = Field(min_length=1, max_length=60)


class BuddyJoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=20, description="A friend's invite code, e.g. K7QM-2XRP")


class BuddySharingIn(BaseModel):
    sharing: bool

import json
import re
from pathlib import Path

from app.data.exercises import EXERCISES
from app.services.workout_service import generate_plan

ROOT = Path(__file__).resolve().parents[2]


def _demos() -> dict:
    ts = (ROOT / "frontend/src/data/exerciseDemos.ts").read_text()
    return json.loads(re.search(r"EXERCISE_DEMOS: Record<string, ExerciseDemo> = (\{.*\})\s*$", ts, re.S).group(1))


def test_every_exercise_has_a_demo_with_images():
    demos = _demos()
    missing = [e["id"] for e in EXERCISES if e["id"] not in demos]
    assert missing == ["burpee"]  # not in the free library; shows step-by-step text instead
    for eid, d in demos.items():
        assert len(d["steps"]) >= 1
        for i in range(d["frames"]):
            assert (ROOT / f"frontend/public/images/exercises/{eid}/{i}.webp").stat().st_size > 2000


def test_new_exercises_are_used_by_the_planner():
    ids = set()
    for seed_goal in ("muscle_gain", "strength", "weight_loss", "recomposition"):
        for split in ("push_pull_legs", "upper_lower", "full_body"):
            p = generate_plan(seed_goal, "intermediate", 4, ["barbell", "dumbbells", "bench", "cables", "machines", "pullup_bar"], 60, split)
            ids |= {e["exercise_id"] for d in p["days"] for e in d["exercises"]}
    assert ids & {"incline_bench", "db_fly", "arnold_press", "front_squat", "skull_crusher", "barbell_curl", "chin_up"}

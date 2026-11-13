"""Builds FitAI's exercise demos from free-exercise-db (public domain / Unlicense):
https://github.com/yuhonas/free-exercise-db

Usage (developer tool, not needed to run FitAI):
    git clone --depth 1 https://github.com/yuhonas/free-exercise-db /tmp/fedb
    python3 scripts/build_exercise_demos.py /tmp/fedb

Writes:
    frontend/public/images/exercises/<fitai_id>/0.webp, 1.webp   (start / end position, 640 px)
    frontend/src/data/exerciseDemos.ts                             (step-by-step instructions)
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]

# FitAI exercise id -> (free-exercise-db id, note when the photos show a close variation)
MAP = {
    "bench_press": ("Barbell_Bench_Press_-_Medium_Grip", None),
    "db_bench": ("Dumbbell_Bench_Press", None),
    "incline_db_press": ("Incline_Dumbbell_Press", None),
    "push_up": ("Pushups", None),
    "cable_fly": ("Cable_Crossover", None),
    "pull_up": ("Pullups", None),
    "lat_pulldown": ("Wide-Grip_Lat_Pulldown", None),
    "barbell_row": ("Bent_Over_Barbell_Row", None),
    "db_row": ("One-Arm_Dumbbell_Row", None),
    "seated_cable_row": ("Seated_Cable_Rows", None),
    "band_row": ("Seated_Cable_Rows", "Shown with a cable machine — same pulling motion with a band anchored at chest height."),
    "inverted_row": ("Inverted_Row", None),
    "ohp": ("Standing_Military_Press", None),
    "db_shoulder_press": ("Seated_Dumbbell_Press", None),
    "lateral_raise": ("Side_Lateral_Raise", None),
    "pike_push_up": ("Handstand_Push-Ups", "Shown as the advanced wall version. For pike push-ups keep your feet on the floor, hips high in an upside-down V."),
    "face_pull": ("Face_Pull", None),
    "db_curl": ("Dumbbell_Bicep_Curl", None),
    "band_curl": ("Dumbbell_Bicep_Curl", "Shown with dumbbells — stand on the band and curl the handles the same way."),
    "hammer_curl": ("Hammer_Curls", None),
    "tricep_pushdown": ("Triceps_Pushdown", None),
    "bench_dip": ("Bench_Dips", None),
    "overhead_ext": ("Dumbbell_One-Arm_Triceps_Extension", None),
    "back_squat": ("Barbell_Squat", None),
    "goblet_squat": ("Goblet_Squat", None),
    "bw_squat": ("Bodyweight_Squat", None),
    "rdl": ("Romanian_Deadlift", None),
    "deadlift": ("Barbell_Deadlift", None),
    "leg_press": ("Leg_Press", None),
    "lunge": ("Bodyweight_Walking_Lunge", None),
    "bulgarian_split": ("Split_Squat_with_Dumbbells", "Shown with the back foot on the floor. For the Bulgarian version rest the back foot on a bench."),
    "hip_thrust": ("Butt_Lift_Bridge", None),
    "leg_curl": ("Lying_Leg_Curls", None),
    "calf_raise": ("Standing_Calf_Raises", None),
    "kb_swing": ("One-Arm_Kettlebell_Swings", "Shown one-handed. Hold the kettlebell with both hands for the standard swing."),
    "plank": ("Plank", None),
    "dead_bug": ("Dead_Bug", None),
    "hanging_knee_raise": ("Hanging_Leg_Raise", "Shown with straight legs. Bend your knees to make it easier."),
    "mountain_climber": ("Mountain_Climbers", None),
    "brisk_walk": ("Walking_Treadmill", None),
    "jump_rope": ("Rope_Jumping", None),
    # burpee: not in the free library -> FitAI shows step-by-step text only
    "incline_bench": ("Barbell_Incline_Bench_Press_-_Medium_Grip", None),
    "db_fly": ("Dumbbell_Flyes", None),
    "chest_dip": ("Dips_-_Chest_Version", None),
    "chin_up": ("Chin-Up", None),
    "db_bent_row": ("Bent_Over_Two-Dumbbell_Row", None),
    "db_shrug": ("Dumbbell_Shrug", None),
    "rear_delt_fly": ("Seated_Bent-Over_Rear_Delt_Raise", None),
    "front_raise": ("Front_Dumbbell_Raise", None),
    "arnold_press": ("Arnold_Dumbbell_Press", None),
    "barbell_curl": ("Barbell_Curl", None),
    "preacher_curl": ("Preacher_Curl", None),
    "skull_crusher": ("EZ-Bar_Skullcrusher", "Shown with an EZ bar; a straight barbell works the same way."),
    "close_grip_bench": ("Close-Grip_Barbell_Bench_Press", None),
    "front_squat": ("Front_Barbell_Squat", None),
    "leg_extension": ("Leg_Extensions", None),
    "db_step_up": ("Dumbbell_Step_Ups", None),
    "seated_calf_raise": ("Seated_Calf_Raise", None),
    "crunch": ("Crunches", None),
    "russian_twist": ("Russian_Twist", None),
    "side_plank": ("Side_Bridge", None),
    "cable_crunch": ("Cable_Crunch", None),
}


# FitAI-written steps where the source has photos but no text
FALLBACK_STEPS = {
    "kb_swing": [
        "Stand with feet a little wider than hips, kettlebell on the floor slightly in front of you.",
        "Hinge at the hips with a flat back and grip the handle; hike the bell back between your legs.",
        "Drive your hips forward explosively so the bell floats up to chest height — arms just guide it.",
        "Let it swing back down between your legs, hinging again, and repeat in a smooth rhythm.",
    ],
    "side_plank": [
        "Lie on your side with your elbow directly under your shoulder and legs stacked.",
        "Lift your hips so your body forms a straight line from head to feet.",
        "Hold, breathing steadily, without letting the hips sag. Switch sides.",
        "Make it easier by bending the knees and keeping the bottom knee on the floor.",
    ],
}


def main(src: str) -> None:
    src_dir = Path(src)
    db = {x["id"]: x for x in json.loads((src_dir / "dist" / "exercises.json").read_text())}
    out_img = ROOT / "frontend/public/images/exercises"
    demos = {}
    for fid, (sid, note) in MAP.items():
        ex = db[sid]
        (out_img / fid).mkdir(parents=True, exist_ok=True)
        for i, rel in enumerate(ex["images"][:2]):
            im = Image.open(src_dir / "exercises" / rel).convert("RGB")
            im.thumbnail((640, 640))
            im.save(out_img / fid / f"{i}.webp", "WEBP", quality=72, method=6)
        demos[fid] = {"steps": ex["instructions"] or FALLBACK_STEPS[fid], "frames": len(ex["images"][:2]), "level": ex.get("level"),
                      "source": ex["name"], **({"note": note} if note else {})}
    ts = ("// Generated by scripts/build_exercise_demos.py from free-exercise-db (public domain). Do not edit by hand.\n"
          "export type ExerciseDemo = { steps: string[]; frames: number; level?: string; source: string; note?: string }\n"
          f"export const EXERCISE_DEMOS: Record<string, ExerciseDemo> = {json.dumps(demos, indent=1, ensure_ascii=False)}\n")
    (ROOT / "frontend/src/data/exerciseDemos.ts").write_text(ts)
    print(f"Built {len(demos)} demos")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/fedb")

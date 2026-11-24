"""Per-lift progress: estimated 1-rep max, personal records and the three kinds of exercise."""
from app.services.lift_service import epley


def _finish(client, auth, plan, day, exercises):
    s = client.post("/api/workouts/sessions/start", json={"plan_id": plan["id"], "day_index": day}, headers=auth).json()
    r = client.patch(f"/api/workouts/sessions/{s['id']}", json={"exercises": exercises, "status": "completed"}, headers=auth)
    assert r.status_code == 200, r.text


def test_epley_formula():
    assert epley(100, 1) == 100
    assert epley(100, 5) == 116.7
    assert epley(60, 30) == epley(60, 12)  # capped: high-rep sets don't inflate the max


def test_lift_progress_tracks_best_set_and_prs(client, auth):
    plan = client.post("/api/workouts/generate", json={"days_per_week": 3}, headers=auth).json()
    base = {"exercise_id": "bench", "name": "Bench Press", "sets": 3, "reps": "8–12", "completed": True}
    for log in ([{"kg": 40, "reps": 10, "done": True}, {"kg": 45, "reps": 6, "done": True}],
                [{"kg": 50, "reps": 8, "done": True}, {"kg": 60, "reps": 1, "done": False}],  # unticked set ignored
                [{"kg": 47.5, "reps": 8, "done": True}]):
        _finish(client, auth, plan, 0, [{**base, "set_log": log}])
    lifts = client.get("/api/workouts/lifts", headers=auth).json()
    bench = next(lift for lift in lifts if lift["exercise_id"] == "bench")
    assert bench["kind"] == "weighted" and bench["unit"] == "kg" and bench["sessions"] == 3
    assert [p["value"] for p in bench["points"]] == [epley(45, 6), epley(50, 8), epley(47.5, 8)]  # 45x6 (54.0) beats 40x10 (53.3)
    assert [p["pr"] for p in bench["points"]] == [False, True, False]
    assert bench["best"]["label"] == "50 kg × 8"
    assert (bench["best"]["kg"], bench["best"]["reps"]) == (50, 8)
    assert bench["change_8w"] == round(epley(47.5, 8) - epley(45, 6), 1)


def test_bodyweight_and_timed_moves(client, auth):
    plan = client.post("/api/workouts/generate", json={"days_per_week": 3}, headers=auth).json()
    _finish(client, auth, plan, 0, [
        {"exercise_id": "push_up", "name": "Push-Up", "reps": "8–12", "set_log": [{"kg": None, "reps": 12, "done": True}, {"kg": None, "reps": 9, "done": True}]},
        {"exercise_id": "plank", "name": "Plank", "reps": "30–45 sec", "set_log": [{"kg": None, "reps": 40, "done": True}]},
        {"exercise_id": "skip", "name": "Not logged", "reps": "10", "set_log": [{"kg": 20, "reps": 5, "done": False}]},
    ])
    lifts = {lift["exercise_id"]: lift for lift in client.get("/api/workouts/lifts", headers=auth).json()}
    assert lifts["push_up"]["kind"] == "bodyweight" and lifts["push_up"]["latest"]["label"] == "12 reps"
    assert lifts["plank"]["kind"] == "timed" and lifts["plank"]["latest"]["label"] == "40 s"
    assert "skip" not in lifts


def test_lifts_need_login_and_are_private(client, auth):
    assert client.get("/api/workouts/lifts").status_code == 401

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


# ---------------------------------------------------------------- auto-progression
from app.services.lift_service import rep_range, suggest  # noqa: E402

BENCH = {"exercise_id": "bench", "name": "Bench Press", "sets": 3, "reps": "8–12", "muscle": "Chest", "equipment": ["barbell"]}


def test_rep_range_parsing():
    assert rep_range("8–12") == (8, 12) and rep_range("5") == (5, 5) and rep_range("30–45 sec") == (30, 45) and rep_range("") == (8, 12)


def test_top_of_range_on_every_set_adds_weight():
    t = suggest(BENCH, [(50, 12), (50, 12), (50, 12)])
    assert (t["action"], t["kg"], t["reps"]) == ("add_weight", 52.5, 8)


def test_lower_body_barbell_and_dumbbells_use_their_own_jumps():
    squat = {**BENCH, "muscle": "Quads"}
    assert suggest(squat, [(80, 12)] * 3)["kg"] == 85
    db_press = {**BENCH, "equipment": ["dumbbells"]}
    assert suggest(db_press, [(20, 12)] * 3)["kg"] == 22


def test_inside_the_range_adds_a_rep_at_the_same_weight():
    t = suggest(BENCH, [(50, 10), (50, 9), (50, 9)])
    assert (t["action"], t["kg"], t["reps"]) == ("add_reps", 50, 10)


def test_missing_the_range_holds_the_weight():
    t = suggest(BENCH, [(55, 8), (55, 6), (55, 5)])
    assert (t["action"], t["kg"], t["reps"]) == ("hold", 55, 8)


def test_fewer_sets_than_planned_does_not_add_weight():
    assert suggest(BENCH, [(50, 12), (50, 12)])["action"] == "add_reps"


def test_progression_for_bodyweight_and_timed_moves():
    push = {"exercise_id": "push_up", "sets": 3, "reps": "8–12", "equipment": ["bodyweight"]}
    assert suggest(push, [(None, 9), (None, 8), (None, 8)]) == {"action": "add_reps", "kg": None, "reps": 9, "last_kg": None, "last_reps": 8}
    assert suggest(push, [(None, 12)] * 3)["action"] == "harder"
    plank = {"exercise_id": "plank", "sets": 3, "reps": "30–45 sec"}
    assert (suggest(plank, [(None, 40), (None, 35)])["action"], suggest(plank, [(None, 40)])["reps"]) == ("add_time", 45)
    assert suggest(BENCH, []) is None


def test_starting_a_workout_attaches_targets(client, auth):
    plan = client.post("/api/workouts/generate", json={"days_per_week": 3}, headers=auth).json()
    first = client.post("/api/workouts/sessions/start", json={"plan_id": plan["id"], "day_index": 0}, headers=auth).json()
    assert all("target" not in e for e in first["exercises"])  # nothing logged yet
    ex0 = first["exercises"][0]
    hi = rep_range(ex0["reps"])[1]
    done = [{**ex0, "set_log": [{"kg": 40, "reps": hi, "done": True}] * int(ex0["sets"])}, *first["exercises"][1:]]
    client.patch(f"/api/workouts/sessions/{first['id']}", json={"exercises": done, "status": "completed"}, headers=auth)
    again = client.post("/api/workouts/sessions/start", json={"plan_id": plan["id"], "day_index": 0}, headers=auth).json()
    t = again["exercises"][0]["target"]
    assert t["action"] in ("add_weight", "add_time") and t["last_reps"] == hi
    assert "set_log" not in again["exercises"][0]  # a new workout starts with an empty log

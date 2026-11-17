"""Users choose the weekdays they train on; a plan's days can be moved later without regenerating it."""


def _gen(client, auth, **body):
    r = client.post("/api/workouts/generate", json={"use_ai": False, **body}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()


def test_default_schedule_unchanged(client, auth):
    p = _gen(client, auth, days_per_week=3)
    assert [d["weekday"] for d in p["days"]] == ["Mon", "Wed", "Fri"]


def test_plan_uses_chosen_days(client, auth):
    p = _gen(client, auth, split="push_pull_legs", training_days=["Sat", "Tue", "Thu"])
    assert [(d["weekday"], d["name"]) for d in p["days"]] == [("Tue", "Push"), ("Thu", "Pull"), ("Sat", "Legs")]
    assert p["rest_days"] == ["Mon", "Wed", "Fri", "Sun"]
    assert p["inputs"]["training_days"] == ["Tue", "Thu", "Sat"] and p["title"].endswith("3 days/week")


def test_duplicate_days_count_once(client, auth):
    p = _gen(client, auth, training_days=["Mon", "Mon", "Thu"])
    assert [d["weekday"] for d in p["days"]] == ["Mon", "Thu"]


def test_change_days_keeps_workouts(client, auth):
    p = _gen(client, auth, split="push_pull_legs", days_per_week=3)
    before = [d["exercises"] for d in p["days"]]
    r = client.patch(f"/api/workouts/plans/{p['id']}/days", json={"training_days": ["Tue", "Thu", "Sat"]}, headers=auth)
    assert r.status_code == 200, r.text
    q = r.json()
    assert [(d["weekday"], d["name"]) for d in q["days"]] == [("Tue", "Push"), ("Thu", "Pull"), ("Sat", "Legs")]
    assert [d["exercises"] for d in q["days"]] == before  # same exercises, only the days moved
    assert q["rest_days"] == ["Mon", "Wed", "Fri", "Sun"]
    again = client.get(f"/api/workouts/plans/{p['id']}", headers=auth).json()
    assert [d["weekday"] for d in again["days"]] == ["Tue", "Thu", "Sat"]  # saved


def test_change_days_needs_matching_count_and_valid_days(client, auth):
    p = _gen(client, auth, days_per_week=3)
    url = f"/api/workouts/plans/{p['id']}/days"
    assert client.patch(url, json={"training_days": ["Tue", "Thu"]}, headers=auth).status_code == 422
    assert client.patch(url, json={"training_days": ["Tue", "Thu", "Funday"]}, headers=auth).status_code == 422


def test_dashboard_follows_new_days(client, auth):
    week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    p = _gen(client, auth, split="push_pull_legs", days_per_week=3)
    client.post(f"/api/workouts/plans/{p['id']}/save", headers=auth)
    h = {**auth, "X-Timezone": "UTC"}
    import datetime
    today = week[datetime.datetime.now(datetime.UTC).weekday()]
    tomorrow = week[(week.index(today) + 1) % 7]
    later = week[(week.index(today) + 3) % 7]
    client.patch(f"/api/workouts/plans/{p['id']}/days", json={"training_days": [tomorrow, later, week[(week.index(today) + 5) % 7]]}, headers=auth)
    up = client.get("/api/dashboard", headers=h).json()["upcoming_workout"]
    assert up["weekday"] == tomorrow and up["when"] == "Tomorrow"
    client.patch(f"/api/workouts/plans/{p['id']}/days", json={"training_days": [today, later, week[(week.index(today) + 5) % 7]]}, headers=auth)
    up = client.get("/api/dashboard", headers=h).json()["upcoming_workout"]
    assert up["weekday"] == today and up["when"] == "Today"


def test_other_users_plan_is_protected(client, auth):
    p = _gen(client, auth, days_per_week=2)
    r = client.patch(f"/api/workouts/plans/{p['id']}/days", json={"training_days": ["Tue", "Fri"]}, headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401

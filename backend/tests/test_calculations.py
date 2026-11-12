import pytest

from app.services import fitness_service as fs


def test_bmr_mifflin_male():
    # 10*80 + 6.25*180 - 5*30 + 5 = 1780
    assert fs.calculate_bmr(80, 180, 30, "male")["bmr"] == 1780


def test_bmr_mifflin_female():
    # 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    assert fs.calculate_bmr(60, 165, 25, "female")["bmr"] == 1345


def test_bmr_neutral_midpoint():
    assert fs.calculate_bmr(70, 170, 30, None)["bmr"] == round(700 + 1062.5 - 150 - 78)


def test_tdee_multiplier():
    assert fs.calculate_tdee(1780, "moderate") == {"tdee": round(1780 * 1.55), "activity_multiplier": 1.55}


def test_weight_loss_deficit_capped_at_500():
    r = fs.calculate_calorie_target(3500, 1900, "weight_loss", "male")
    assert r["adjustment"] == -500 and r["calorie_target"] == 3000


def test_calorie_floor_enforced():
    r = fs.calculate_calorie_target(1300, 1150, "weight_loss", "female")
    assert r["calorie_target"] >= 1200 and r["warnings"]


def test_muscle_gain_surplus_capped():
    assert fs.calculate_calorie_target(3200, 1900, "muscle_gain")["adjustment"] == 300


def test_macros_sum_close_to_target():
    m = fs.calculate_macros(2200, 80, "muscle_gain", 180)
    kcal = m["protein_g"] * 4 + m["carbs_g"] * 4 + m["fat_g"] * 9
    assert abs(kcal - 2200) < 15
    assert m["protein_g"] == round(1.8 * 80)


def test_bmi():
    r = fs.calculate_bmi(70, 175)
    assert r["bmi"] == 22.9 and r["category"] == "Healthy range"


def test_invalid_inputs():
    with pytest.raises(ValueError):
        fs.calculate_tdee(1500, "couch")
    with pytest.raises(ValueError):
        fs.calculate_bmr(-1, 170, 30, None)


def test_streak_allows_one_rest_day():
    from datetime import date, timedelta

    from app.services.progress_service import workout_streak
    t = date(2026, 1, 20)
    days = [t, t - timedelta(days=2), t - timedelta(days=3), t - timedelta(days=5), t - timedelta(days=9)]
    assert workout_streak(days, t) == 4
    assert workout_streak([t - timedelta(days=4)], t) == 0

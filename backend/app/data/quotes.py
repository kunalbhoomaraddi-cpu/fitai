"""Original FitAI motivational content (written for this project; no attribution required)."""
from datetime import date

from app.utils.clock import local_today

QUOTES: list[dict] = [
    {"category": "Discipline", "text": "Motivation gets you started. Systems get you to the finish line."},
    {"category": "Discipline", "text": "Do the boring basics brilliantly. That's the whole secret."},
    {"category": "Discipline", "text": "You don't need a perfect day. You need a day that counts."},
    {"category": "Discipline", "text": "The plan works when you work the plan — even on the days you don't feel like it."},
    {"category": "Discipline", "text": "Small promises kept to yourself build the biggest confidence."},
    {"category": "Consistency", "text": "Ten average workouts beat one heroic one."},
    {"category": "Consistency", "text": "Progress hides in the weeks you almost skipped but didn't."},
    {"category": "Consistency", "text": "Show up, log it, repeat. The trend line will do the talking."},
    {"category": "Consistency", "text": "Consistency is just patience wearing training shoes."},
    {"category": "Consistency", "text": "A missed day is a data point, not a verdict. Get back on track at the next meal."},
    {"category": "Weight loss", "text": "The scale measures weight, not effort. Watch the weekly average, not the daily noise."},
    {"category": "Weight loss", "text": "Sustainable beats extreme. Every single time."},
    {"category": "Weight loss", "text": "You're not on a diet. You're building how you'll eat for the rest of your life."},
    {"category": "Weight loss", "text": "Fuel your body like someone you care about. Because you are."},
    {"category": "Weight loss", "text": "Patience with the process is a strategy, not a weakness."},
    {"category": "Strength", "text": "Strength is earned one clean rep at a time."},
    {"category": "Strength", "text": "Leave a rep in the tank today so you can add a kilo next week."},
    {"category": "Strength", "text": "Form first. Load follows."},
    {"category": "Strength", "text": "The bar doesn't care about your mood. That's what makes it honest."},
    {"category": "Strength", "text": "Getting stronger is just adding a little more, a little often."},
    {"category": "Mental toughness", "text": "The hardest set is usually the one that starts in your head."},
    {"category": "Mental toughness", "text": "Comfort is a fine place to visit. Growth lives one step past it."},
    {"category": "Mental toughness", "text": "When it gets hard, get curious instead of quitting."},
    {"category": "Mental toughness", "text": "You've survived every tough day so far. This one is no different."},
    {"category": "Mental toughness", "text": "Discipline is choosing what you want most over what you want now."},
    {"category": "Recovery", "text": "Muscles are built in the gym and rebuilt while you sleep."},
    {"category": "Recovery", "text": "A rest day is part of the program, not a break from it."},
    {"category": "Recovery", "text": "Listen to the whispers of fatigue before they become shouts of injury."},
    {"category": "Recovery", "text": "Water, sleep, protein, patience. Repeat."},
    {"category": "Recovery", "text": "Recovery is where effort turns into results."},
    {"category": "Personal growth", "text": "Compare yourself to last month's you, not to someone else's highlight reel."},
    {"category": "Personal growth", "text": "Every logged meal is a lesson about yourself."},
    {"category": "Personal growth", "text": "Fitness isn't a destination. It's how you take care of the person you're becoming."},
    {"category": "Personal growth", "text": "Celebrate the habit, not just the outcome."},
    {"category": "Personal growth", "text": "Becoming 1% better is invisible today and undeniable in a year."},
]


def quote_of_the_day(d: date | None = None) -> dict:
    d = d or local_today()
    q = QUOTES[d.toordinal() % len(QUOTES)]
    return {**q, "author": "FitAI Coach", "date": d.isoformat()}

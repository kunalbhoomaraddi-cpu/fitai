export type Goal = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'general_fitness' | 'maintenance'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Diet = 'vegetarian' | 'vegan' | 'eggetarian' | 'non_vegetarian' | 'custom'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Units = 'metric' | 'imperial'
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'
export interface MealPhotoItem {
  name: string; seen_as: string; grams: number; portion: string | null
  per_100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number }
  calories: number; protein_g: number; carbs_g: number; fat_g: number
  basis: 'database' | 'ai_estimate'; source_id: string | null; servings: { label: string; grams: number }[]; confidence: number
  check_amount?: boolean
}
export interface MealPhotoResult { items: MealPhotoItem[]; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }; is_food: boolean; note: string | null; model: string; seconds: number }

export interface User {
  id: number; email: string; full_name: string; is_demo: boolean; email_verified: boolean; onboarding_complete: boolean; ai_provider_pref: string; coach_language?: CoachLanguage; needs_consent?: boolean
}
export interface Profile {
  full_name?: string; age: number; gender: 'male' | 'female' | 'other' | null; height_cm: number
  current_weight_kg: number; target_weight_kg: number; start_weight_kg?: number; activity_level: Activity
  experience: Experience; goal: Goal; diet_preference: Diet; custom_diet: string | null; food_restrictions: string[]
  workout_days_per_week: number; workout_minutes: number; equipment: string[]; unit_system: Units
  adaptive_target?: boolean
}
export interface Macros { calories: number; protein_g: number; carbs_g: number; fat_g: number }
export interface FoodEntry {
  id: number; eaten_on: string; meal: MealType; name: string; quantity_g: number; calories: number
  protein_g: number; carbs_g: number; fat_g: number; source: string; source_id?: string | null
}
export interface FoodResult {
  id: string; name: string; brand: string | null; calories_100g: number; protein_100g: number
  carbs_100g: number; fat_100g: number; source: string; image_url: string | null
  servings?: { label: string; grams: number }[]; diet?: string; category?: string
}
export interface Achievement {
  code: string; title: string; description: string; icon: string; unlocked: boolean; unlocked_at: string | null; seen: boolean
}
export interface Challenge { id: string; title: string; progress: number; goal: number; icon: string; completed: boolean }
export interface Insight { type: string; title: string; text: string }
export interface Card {
  type: string; title: string; [k: string]: any
}
export interface ChatMessage {
  id: number; role: 'user' | 'assistant'; content: string; cards: Card[]; tools_used: string[]
  provider: string | null; created_at: string; pending?: boolean
}
export interface MealItem { name: string; grams: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; food_key: string | null }
export interface Meal {
  slot: number; label: string; meal_type: MealType; name: string; image: string; items: MealItem[]
  instructions: string; nutrition_source: string; nutrition_note: string; completed: boolean; totals: Macros
}
export interface DietPlan {
  id: number; title: string; plan_date: string | null; targets: { calorie_target: number; protein_g: number; carbs_g: number; fat_g: number }
  preferences: Record<string, any>; meals: Meal[]; totals: Macros; generated_by: string; coach_note: string | null
  is_saved: boolean; created_at: string; notice?: string | null
}
export interface Exercise {
  exercise_id: string; name: string; muscle: string; secondary: string[]; equipment: string[]; instructions: string
  image: string; sets: number; reps: string; rest_seconds: number; completed: boolean; sets_done?: number; set_log?: SetEntry[]; target?: SetTarget
  swapped_from?: string
}
export interface WorkoutDay { index: number; weekday: string; name: string; focus: string[]; duration_minutes: number; exercises: Exercise[] }
export interface WorkoutPlan {
  id: number; title: string; split: string; inputs: Record<string, any>; days: WorkoutDay[]; generated_by: string
  coach_note: string | null; is_saved: boolean; rest_days: string[]; recovery_note: string | null; created_at: string; notice?: string | null
}
export interface WorkoutSession {
  id: number; plan_id: number | null; name: string; started_at: string; completed_at: string | null
  duration_minutes: number | null; exercises: Exercise[]; status: string; new_achievements?: string[]
}
export interface AIStatus { active_provider: string; model: string; is_real_llm: boolean; configured: Record<string, boolean>; message: string | null }

/** One logged set during a workout: weight in kg (null for bodyweight), reps done, and whether it is ticked. */
export interface SetEntry { kg: number | null; reps: number | null; done: boolean }

/** A food the user logged recently, offered for one-tap re-logging. */
export interface RecentFood { name: string; quantity_g: number; calories: number; protein_g: number; carbs_g: number; fat_g: number; source: string; source_id: string | null; meal: string }

/** One session's best effort on a lift (from /workouts/lifts). */
export interface LiftPoint { date: string; value: number; label: string; kg: number | null; reps: number; volume: number; pr: boolean }
export interface Lift {
  exercise_id: string; name: string; kind: 'weighted' | 'bodyweight' | 'timed'; unit: string; metric: string
  sessions: number; last_date: string; latest: LiftPoint; best: LiftPoint; change_8w: number | null; prs: number; points: LiftPoint[]
}

/** Today's suggested weight and reps, worked out from the last time the exercise was logged (kg). */
export interface SetTarget { action: 'add_weight' | 'add_reps' | 'hold' | 'add_time' | 'harder'; kg: number | null; reps: number; last_kg: number | null; last_reps: number }

/** A meal the user saved to log again in one tap. */
export interface SavedMeal { id: number; name: string; meal: MealType; items: RecentFood[]; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number } }

export type CoachLanguage = 'en' | 'hi' | 'kn'
/** Water drunk on a day, in ml, against a goal based on body weight. */
export interface WaterDay { date: string; ml: number; goal_ml: number; glasses: number; goal_glasses: number }
export type BreakKind = 'travel' | 'festival'
/** A travel or festival break: maintenance calories and a paused streak until end_on. */
export interface Break { id: number; kind: BreakKind; label: string; start_on: string; end_on: string; note: string | null; active: boolean; days_left: number }
/** An exercise that can replace another mid-workout. */
export interface SwapOption { exercise_id: string; name: string; muscle: string; equipment: string[]; type: string; same_muscle: boolean }

/** A meal described by voice or text, split into foods to review. */
export interface MealTextResult { text: string; items: MealPhotoItem[]; totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number }; source: string; notice: string | null; not_found: string[] }

/** Maintenance worked out from logged food and the weight trend. */
export interface AdaptiveEstimate {
  enabled: boolean; status: 'ready' | 'collecting'; formula_tdee: number; tdee: number; estimated_tdee: number | null
  logged_days: number; weigh_ins: number; weigh_span_days: number; window_days: number
  needs: { logged_days: number; weigh_ins: number; weigh_span_days: number }
  confidence: number; avg_intake?: number; weekly_change_kg?: number; difference?: number; capped?: boolean
}

export interface RecapPR { name: string; label: string; kg: number | null; reps: number; kind: string; date: string }
/** Monday-to-Sunday summary. */
export interface WeeklyRecap {
  which: 'last' | 'this'; start: string; end: string; days_in: number; name: string | null; empty: boolean; highlight: string
  workouts: { count: number; minutes: number; sets: number; volume_kg: number; days: string[]; planned: number; prev_count: number; prev_volume_kg: number }
  prs: RecapPR[]
  nutrition: { days_logged: number; calorie_target: number; protein_target: number; avg_calories: number | null; avg_protein: number | null; days_on_target: number; protein_days: number }
  weight: { weigh_ins: number; start_kg: number | null; end_kg: number | null; change_kg: number | null; goal: string }
  water: { days_logged: number; avg_ml: number | null; goal_ml: number; days_goal_met: number }
  streak: number; best_streak: number | null
}

/** Workout buddies: all a buddy can see is a first name, this week's workout days and a streak. */
export interface BuddyDay { date: string; trained: boolean; future: boolean }
export interface BuddyActivity { week: BuddyDay[]; workouts_this_week: number; planned_per_week: number | null; streak: number; on_break: boolean; trained_today: boolean; last_workout: string | null }
export interface Buddy { id: number; name: string; since: string; sharing: boolean; activity: BuddyActivity | null; nudged_today: boolean }
export interface BuddyNudge { id: number; from_id: number; from_name: string; at: string }
export interface BuddyOverview { code: string | null; sharing: boolean; max_buddies: number; buddies: Buddy[]; nudges: BuddyNudge[]; demo: boolean }

export type Goal = 'weight_loss' | 'muscle_gain' | 'recomposition' | 'general_fitness' | 'maintenance'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type Diet = 'vegetarian' | 'vegan' | 'eggetarian' | 'non_vegetarian' | 'custom'
export type Experience = 'beginner' | 'intermediate' | 'advanced'
export type Units = 'metric' | 'imperial'
export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

export interface User {
  id: number; email: string; full_name: string; is_demo: boolean; email_verified: boolean; onboarding_complete: boolean; ai_provider_pref: string
}
export interface Profile {
  full_name?: string; age: number; gender: 'male' | 'female' | 'other' | null; height_cm: number
  current_weight_kg: number; target_weight_kg: number; start_weight_kg?: number; activity_level: Activity
  experience: Experience; goal: Goal; diet_preference: Diet; custom_diet: string | null; food_restrictions: string[]
  workout_days_per_week: number; workout_minutes: number; equipment: string[]; unit_system: Units
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
  image: string; sets: number; reps: string; rest_seconds: number; completed: boolean; sets_done?: number
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

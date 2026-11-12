import { api } from './api'
import type { AIStatus, Achievement, Challenge, ChatMessage, DietPlan, FoodEntry, FoodResult, Profile, User, WorkoutPlan, WorkoutSession } from '../types'

export type Verification = { delivery: 'email' | 'console' | 'failed' | 'none'; error?: string; expires_in_minutes?: number; resend_in_seconds?: number }
type Token = { access_token: string; user: User; verification?: Verification | null }
export type OtpChallenge = { otp_required: true; otp_token: string; delivery: 'email' | 'console'; email_masked: string; expires_in_minutes: number; resend_in_seconds: number }

export const authApi = {
  login: (email: string, password: string) => api.post<Token | OtpChallenge>('/auth/login', { email, password }),
  loginVerify: (otp_token: string, code: string) => api.post<Token>('/auth/login/verify', { otp_token, code }),
  loginResend: (otp_token: string) => api.post<{ delivery: string; resend_in_seconds: number }>('/auth/login/resend', { otp_token }),
  register: (full_name: string, email: string, password: string) => api.post<Token>('/auth/register', { full_name, email, password }),
  demo: () => api.post<Token>('/auth/demo'),
  me: () => api.get<User>('/auth/me'),
  verifyEmail: (code: string) => api.post<User>('/auth/verify-email', { code }),
  resendCode: () => api.post<Verification>('/auth/resend-code'),
  logout: () => api.post<void>('/auth/logout'),
}
export const profileApi = {
  get: () => api.get<Profile | null>('/profile'),
  save: (p: Partial<Profile>) => api.put<Profile>('/profile', p),
  targets: () => api.get<any>('/profile/targets'),
  calculate: (b: any) => api.post<any>('/profile/calculate', b),
}
export const dashboardApi = { get: (refresh = false) => api.get<any>(`/dashboard${refresh ? '?refresh_recommendation=true' : ''}`) }
export const coachApi = {
  status: () => api.get<AIStatus>('/coach/status'),
  suggestions: () => api.get<string[]>('/coach/suggestions'),
  conversations: () => api.get<{ id: number; title: string; updated_at: string; message_count: number }[]>('/coach/conversations'),
  conversation: (id: number) => api.get<{ id: number; title: string; messages: ChatMessage[] }>(`/coach/conversations/${id}`),
  remove: (id: number) => api.del<void>(`/coach/conversations/${id}`),
  save: (title: string, content: string, category = 'general') => api.post<{ id: number }>('/coach/save', { title, content, category }),
  chat: (message: string, conversation_id?: number | null) =>
    api.post<{ conversation_id: number; title: string; user_message: ChatMessage; message: ChatMessage; is_real_llm: boolean; notice: string | null }>(
      '/coach/chat', { message, conversation_id: conversation_id ?? null }),
}
export const dietApi = {
  generate: (b: any) => api.post<DietPlan>('/diet/generate', b),
  plans: () => api.get<DietPlan[]>('/diet/plans'),
  latest: () => api.get<DietPlan | null>('/diet/plans/latest'),
  save: (id: number) => api.post<DietPlan>(`/diet/plans/${id}/save`),
  remove: (id: number) => api.del<void>(`/diet/plans/${id}`),
  regenerateMeal: (id: number, slot: number) => api.post<DietPlan>(`/diet/plans/${id}/regenerate-meal`, { slot }),
  replaceItem: (id: number, slot: number, item_index: number) => api.post<DietPlan>(`/diet/plans/${id}/replace-item`, { slot, item_index }),
  completeMeal: (id: number, slot: number, completed: boolean) => api.post<DietPlan>(`/diet/plans/${id}/complete-meal`, { slot, completed, log_to_tracker: true }),
}
export const workoutApi = {
  generate: (b: any) => api.post<WorkoutPlan>('/workouts/generate', b),
  plans: () => api.get<WorkoutPlan[]>('/workouts/plans'),
  active: () => api.get<WorkoutPlan | null>('/workouts/plans/active'),
  save: (id: number) => api.post<WorkoutPlan>(`/workouts/plans/${id}/save`),
  remove: (id: number) => api.del<void>(`/workouts/plans/${id}`),
  start: (plan_id: number | null, day_index: number) => api.post<WorkoutSession>('/workouts/sessions/start', { plan_id, day_index }),
  activeSession: () => api.get<WorkoutSession | null>('/workouts/sessions/active'),
  updateSession: (id: number, b: any) => api.patch<WorkoutSession>(`/workouts/sessions/${id}`, b),
  history: () => api.get<WorkoutSession[]>('/workouts/sessions'),
  stats: () => api.get<any>('/workouts/stats'),
  exerciseInfo: (name: string) => api.get<any>(`/workouts/exercise-info?name=${encodeURIComponent(name)}`),
}
export const nutritionApi = {
  search: (q: string) => api.get<{ results: FoodResult[]; source: string; warning: string | null }>(`/nutrition/search?q=${encodeURIComponent(q)}`),
  day: (date?: string) => api.get<any>(`/nutrition/day${date ? `?date=${date}` : ''}`),
  add: (b: Partial<FoodEntry>) => api.post<FoodEntry>('/nutrition/entries', b),
  update: (id: number, b: Partial<FoodEntry>) => api.patch<FoodEntry>(`/nutrition/entries/${id}`, b),
  remove: (id: number) => api.del<void>(`/nutrition/entries/${id}`),
  history: (days = 14) => api.get<any[]>(`/nutrition/history?days=${days}`),
}
export const progressApi = {
  weights: () => api.get<{ id: number; recorded_on: string; weight_kg: number; note: string | null }[]>('/progress/weights'),
  addWeight: (b: any) => api.post<any>('/progress/weights', b),
  removeWeight: (id: number) => api.del<void>(`/progress/weights/${id}`),
  measurements: () => api.get<any[]>('/progress/measurements'),
  addMeasurement: (b: any) => api.post<any>('/progress/measurements', b),
  removeMeasurement: (id: number) => api.del<void>(`/progress/measurements/${id}`),
  setTarget: (target_weight_kg: number) => api.put<any>('/progress/target', { target_weight_kg }),
  analysis: () => api.get<any>('/progress/analysis'),
  aiAnalysis: () => api.post<any>('/progress/ai-analysis'),
  achievements: () => api.get<Achievement[]>('/progress/achievements'),
  markSeen: () => api.post<void>('/progress/achievements/seen'),
  challenges: () => api.get<Challenge[]>('/progress/challenges'),
}
export const settingsApi = {
  get: () => api.get<any>('/settings'),
  update: (b: any) => api.put<any>('/settings', b),
  password: (current_password: string, new_password: string) => api.post<void>('/settings/password', { current_password, new_password }),
  deleteAccount: () => api.del<void>('/settings/account'),
}

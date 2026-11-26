import type { CoachLanguage } from '../types'

/** Languages the coach can reply in, each written in its own script. */
export const COACH_LANGUAGES: readonly (readonly [CoachLanguage, string])[] = [['en', 'English'], ['hi', 'हिन्दी'], ['kn', 'ಕನ್ನಡ']] as const
export const LANGUAGE_NAME: Record<CoachLanguage, string> = { en: 'English', hi: 'Hindi', kn: 'Kannada' }

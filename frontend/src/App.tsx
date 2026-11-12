import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import { Logo, PageSkeleton } from './components/ui'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import VerifyEmail from './pages/VerifyEmail/VerifyEmail'

const Landing = lazy(() => import('./pages/Landing/Landing'))
const Onboarding = lazy(() => import('./pages/Onboarding/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'))
const AICoach = lazy(() => import('./pages/AICoach/AICoach'))
const DietPlanner = lazy(() => import('./pages/DietPlanner/DietPlanner'))
const WorkoutPlanner = lazy(() => import('./pages/WorkoutPlanner/WorkoutPlanner'))
const NutritionTracker = lazy(() => import('./pages/NutritionTracker/NutritionTracker'))
const ProgressTracker = lazy(() => import('./pages/ProgressTracker/ProgressTracker'))
const Settings = lazy(() => import('./pages/Settings/Settings'))

function Splash() {
  return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse"><Logo /></div></div>
}

function Protected({ children, needsProfile = true }: { children: ReactNode; needsProfile?: boolean }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!user.email_verified) return <Navigate to="/verify-email" replace />
  if (needsProfile && !user.onboarding_complete) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (user) return <Navigate to={!user.email_verified ? '/verify-email' : user.onboarding_complete ? '/dashboard' : '/onboarding'} replace />
  return <>{children}</>
}

function VerifyRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (user.email_verified) return <Navigate to={user.onboarding_complete ? '/dashboard' : '/onboarding'} replace />
  return <VerifyEmail />
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/verify-email" element={<VerifyRoute />} />
        <Route path="/onboarding" element={<Protected needsProfile={false}><Onboarding /></Protected>} />
        <Route element={<Protected><AppLayout /></Protected>}>
          <Route path="/dashboard" element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
          <Route path="/coach" element={<Suspense fallback={<PageSkeleton />}><AICoach /></Suspense>} />
          <Route path="/diet" element={<Suspense fallback={<PageSkeleton />}><DietPlanner /></Suspense>} />
          <Route path="/workouts" element={<Suspense fallback={<PageSkeleton />}><WorkoutPlanner /></Suspense>} />
          <Route path="/nutrition" element={<Suspense fallback={<PageSkeleton />}><NutritionTracker /></Suspense>} />
          <Route path="/progress" element={<Suspense fallback={<PageSkeleton />}><ProgressTracker /></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageSkeleton />}><Settings /></Suspense>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

import { Navigate, Outlet } from 'react-router'
import { PageLoader } from '../components/PageLoader'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../types/user'

type ProtectedRouteProps = {
  // Omit to allow any signed-in user.
  role?: UserRole
}

// Layout route for views that need a signed-in user. Signed-out users go to
// the login view, users with another role go to the home view.
export const ProtectedRoute = ({ role }: ProtectedRouteProps) => {
  const { user, status } = useAuth()

  if (status === 'loading') return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />

  return <Outlet />
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import BoardPage from './pages/BoardPage'
import FlowEditorPage from './pages/FlowEditorPage'
import OnboardingPage from './pages/OnboardingPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/board"
        element={
          <PrivateRoute>
            <BoardPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/flows/:id/edit"
        element={
          <PrivateRoute>
            <FlowEditorPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <PrivateRoute>
            <OnboardingPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  )
}
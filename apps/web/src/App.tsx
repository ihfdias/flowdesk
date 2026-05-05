import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import BoardPage from './pages/BoardPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/board"
        element={
          <PrivateRoute>
            <BoardPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/board" replace />} />
    </Routes>
  )
}
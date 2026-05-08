import { createContext, useContext, useState, ReactNode } from 'react'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextData {
  user: User | null
  token: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData)

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const stored = localStorage.getItem('flowdesk:token')
    if (!stored || isTokenExpired(stored)) {
      localStorage.removeItem('flowdesk:token')
      localStorage.removeItem('flowdesk:user')
      return null
    }
    return stored
  })

  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('flowdesk:user')
    return stored ? (JSON.parse(stored) as User) : null
  })

  function login(newToken: string, newUser: User) {
    localStorage.setItem('flowdesk:token', newToken)
    localStorage.setItem('flowdesk:user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function logout() {
    localStorage.removeItem('flowdesk:token')
    localStorage.removeItem('flowdesk:user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

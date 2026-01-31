import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Monitor from './pages/Monitor'
import Statistics from './pages/Statistics'
import Others from './pages/Others'
import ProtectedRoute from './components/ProtectedRoute'

function AppRoutes() {
  const { user } = useAuth()

  // Apply server theme to body globally
  useEffect(() => {
    document.body.classList.add('server-theme')
    return () => {
      document.body.classList.remove('server-theme')
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/monitor"
        element={
          <ProtectedRoute>
            <Monitor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistics"
        element={
          <ProtectedRoute>
            <Statistics />
          </ProtectedRoute>
        }
      />
      <Route path="/changelog" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/others"
        element={
          <ProtectedRoute>
            <Others />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: 'rgba(25, 30, 45, 0.95)',
              color: 'rgb(157, 157, 189)',
              border: '1px solid rgba(157, 157, 189, 0.3)',
              fontFamily: "'Courier New', monospace",
              borderRadius: '8px',
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App


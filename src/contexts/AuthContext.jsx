import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithCustomToken } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { SSO_URL } from '../config/api'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

async function checkUserExists(email) {
  try {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('email', '==', email))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data()
    }
    return null
  } catch (error) {
    console.error('Error checking email:', error)
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for SSO data on page load
    const urlParams = new URLSearchParams(window.location.search)
    const ssoParam = urlParams.get('sso')

    if (ssoParam) {
      try {
        const ssoData = JSON.parse(decodeURIComponent(ssoParam))
        handleSSOAuthentication(ssoData)
        // Clear the URL parameter
        const newUrl = window.location.pathname + window.location.hash
        window.history.replaceState({}, document.title, newUrl)
      } catch (error) {
        console.error('Error parsing SSO data:', error)
      }
    }

    // Listen for postMessage from SSO popup
    const messageHandler = (event) => {
      if (event.origin !== SSO_URL) {
        return
      }

      const data = event.data

      if (data && data.token && data.tokenType === 'custom_token') {
        console.log('SSO data received via postMessage:', data)
        handleSSOAuthentication(data)
      } else if (data && data.success === false) {
        console.error('SSO error received:', data.error)
      }
    }

    window.addEventListener('message', messageHandler)

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData = await checkUserExists(firebaseUser.email)
        if (userData) {
          setUser(userData)
        } else {
          await signOut()
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => {
      unsubscribe()
      window.removeEventListener('message', messageHandler)
    }
  }, [])

  async function handleSSOAuthentication(ssoData) {
    if (!ssoData || !ssoData.token) {
      console.error('Invalid SSO data')
      return
    }

    try {
      console.log('Authenticating with SSO token...')
      await signInWithCustomToken(auth, ssoData.token)
      console.log('SSO authentication successful')
      localStorage.setItem('ssoData', JSON.stringify(ssoData))
    } catch (error) {
      console.error('SSO authentication failed:', error)
    }
  }

  async function signInWithGoogle() {
    try {
      const ssoUrl = `${SSO_URL}?popup=true&parent=${encodeURIComponent(window.location.origin)}`
      const popup = window.open(ssoUrl, 'SSO Login', 'width=500,height=600,scrollbars=yes,resizable=yes')

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SSO authentication timeout'))
        }, 60000)

        const handler = (event) => {
          if (event.origin !== SSO_URL) {
            return
          }

          const data = event.data

          if (data && data.token && data.tokenType === 'custom_token') {
            clearTimeout(timeout)
            window.removeEventListener('message', handler)
            resolve(data)
          } else if (data && data.success === false) {
            clearTimeout(timeout)
            window.removeEventListener('message', handler)
            reject(new Error(data.error || 'SSO authentication failed'))
          }
        }

        window.addEventListener('message', handler)
      })

      if (popup && !popup.closed) {
        popup.close()
      }

      await handleSSOAuthentication(result)
    } catch (error) {
      console.error('SSO authentication error:', error)
      throw error
    }
  }

  async function signOut() {
    try {
      await firebaseSignOut(auth)
      localStorage.removeItem('ssoData')
      setUser(null)
      window.location.reload()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const value = {
    user,
    loading,
    signInWithGoogle,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}


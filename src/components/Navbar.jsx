import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Menu, X, Loader2 } from 'lucide-react'
import './Navbar.css'

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut, signInWithGoogle } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const menuRef = useRef(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMobileMenuOpen(false)
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [mobileMenuOpen])

  // Close menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navItems = [
    { path: '/dashboard', icon: 'home', label: 'Dashboard' },
    { path: '/statistics', icon: 'bar_chart', label: 'Statistics' },
    { path: '/monitor', icon: 'track_changes', label: 'Monitor' },
    // { path: '/changelog', icon: 'history', label: 'Changelog' }, // disabled for now
    { path: '/others', icon: 'expand_circle_down', label: 'Others' }
  ]

  const handleLogout = async () => {
    await signOut()
  }

  const handleLogin = async () => {
    setIsLoggingIn(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Login failed:', error)
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <>
      {mobileMenuOpen && user && (
        <div 
          className="mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <header className="navbar-header">
        <div className="navbar-content">
          <div className="navbar-logo">
            <div className="status-indicator active"></div>
            <h1 onClick={() => navigate('/')} className="navbar-title">
              <span className="terminal-prompt">$</span>
              <span className="server-name">ITCPR_SERVER</span>
            </h1>
          </div>
          <nav ref={menuRef} className={`navbar-nav ${mobileMenuOpen && user ? 'mobile-open' : ''}`}>
                 {user ? (
                   <>
                     <button 
                       className="mobile-menu-toggle"
                       onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                       aria-label="Toggle menu"
                       aria-expanded={mobileMenuOpen}
                     >
                       {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                     </button>
                     <div className="navbar-items-wrapper">
                       {navItems.map((item) => (
                         <div
                           key={item.path}
                           onClick={() => {
                             navigate(item.path)
                             setMobileMenuOpen(false)
                           }}
                           className={`navbar-item ${location.pathname === item.path ? 'selected' : ''}`}
                         >
                           <span className="material-icons">{item.icon}</span>
                           <span className="navbar-item-label">{item.label}</span>
                         </div>
                       ))}
                       <div 
                         onClick={() => {
                           handleLogout()
                           setMobileMenuOpen(false)
                         }} 
                         className="navbar-item" 
                         id="logoutBtn"
                       >
                         <span className="material-icons">logout</span>
                         <span className="navbar-item-label">Logout</span>
                       </div>
                     </div>
                   </>
                 ) : (
                   <button className="server-btn" onClick={handleLogin} disabled={isLoggingIn}>
                     {isLoggingIn ? (
                       <>
                         <Loader2 size={16} className="btn-spinner" />
                         <span>LOGGING IN...</span>
                       </>
                     ) : (
                       <>
                         <LogIn size={16} />
                         <span>LOGIN</span>
                       </>
                     )}
                   </button>
          )}
          </nav>
        </div>
      </header>
    </>
  )
}

export default Navbar


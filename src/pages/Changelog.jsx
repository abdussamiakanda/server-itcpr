import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ref as dbRef, get as getRTData } from 'firebase/database'
import { rtdb } from '../config/firebase'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Changelog.css'

function Changelog() {
  const { user: userData } = useAuth()
  const [windowsSoftwares, setWindowsSoftwares] = useState([])
  const [wslPackages, setWslPackages] = useState([])
  const [winSearchTerm, setWinSearchTerm] = useState('')
  const [wslSearchTerm, setWslSearchTerm] = useState('')

  useEffect(() => {
    if (userData) {
      loadAvailableSoftwares()
      loadAvailablePackages()
    }
  }, [userData])

  async function loadAvailableSoftwares() {
    try {
      const snapshot = await getRTData(dbRef(rtdb, 'windows_softwares'))
      const data = snapshot.val()

      if (data) {
        const softwares = Object.values(data).map(item => ({
          ...item,
          formattedDate: item.install_date
            ? formatDate(item.install_date)
            : 'Unknown date'
        }))
        setWindowsSoftwares(softwares)
      }
    } catch (error) {
      console.error('Error loading Windows softwares:', error)
    }
  }

  async function loadAvailablePackages() {
    try {
      const snapshot = await getRTData(dbRef(rtdb, 'wsl_softwares'))
      const data = snapshot.val()

      if (data) {
        const packages = Object.values(data).map(item => ({
          ...item,
          formattedDate: item.install_datetime
            ? formatDate(item.install_datetime)
            : 'Unknown date'
        }))
        setWslPackages(packages)
      }
    } catch (error) {
      console.error('Error loading WSL packages:', error)
    }
  }

  function formatDate(dateString) {
    try {
      if (!dateString) return 'Unknown date'
      
      let date
      if (dateString.length === 8) {
        // Format: YYYYMMDD
        const formattedDate = `${dateString.slice(0, 4)}-${dateString.slice(4, 6)}-${dateString.slice(6)}`
        date = new Date(formattedDate)
      } else {
        date = new Date(dateString)
      }

      if (isNaN(date.getTime())) {
        return 'Unknown date'
      }

      return date.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'Unknown date'
    }
  }

  const filteredWindows = windowsSoftwares.filter(item =>
    item.name?.toLowerCase().includes(winSearchTerm.toLowerCase())
  )

  const filteredWsl = wslPackages.filter(item =>
    item.name?.toLowerCase().includes(wslSearchTerm.toLowerCase())
  )

  return (
    <div className="page-container">
      <Navbar />
      <main className="changelog-main">
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> WINDOWS_SOFTWARES
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={winSearchTerm}
              onChange={(e) => setWinSearchTerm(e.target.value)}
              className="search-input"
              style={{ marginLeft: 'auto', maxWidth: '200px' }}
            />
          </div>
          <div className="card-content">
          <div className="windows-software-list">
            <details open>
              <ul>
                {filteredWindows.length > 0 ? (
                  filteredWindows.map((item, idx) => (
                    <li key={idx}>
                      {item.name}
                      <span className="date-text"> — ({item.formattedDate})</span>
                    </li>
                  ))
                ) : (
                  <li>No results found.</li>
                )}
              </ul>
            </details>
          </div>
          </div>
        </div>

        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> WSL_PACKAGES
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={wslSearchTerm}
              onChange={(e) => setWslSearchTerm(e.target.value)}
              className="search-input"
              style={{ marginLeft: 'auto', maxWidth: '200px' }}
            />
          </div>
          <div className="card-content">
          <div className="wsl-software-list">
            <details open>
              <ul>
                {filteredWsl.length > 0 ? (
                  filteredWsl.map((item, idx) => (
                    <li key={idx}>
                      {item.name}
                      <span className="date-text"> — {item.version || 'unknown'} [{item.action === 'install' ? 'installed' : 'upgraded'}] ({item.formattedDate})</span>
                    </li>
                  ))
                ) : (
                  <li>No results found.</li>
                )}
              </ul>
            </details>
          </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Changelog


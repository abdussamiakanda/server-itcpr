import { useState, useEffect, useCallback } from 'react'
import { DateTime } from 'luxon'
import { useAuth } from '../contexts/AuthContext'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { API_BASE_URL } from '../config/api'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Monitor.css'

function Monitor() {
  const { user: userData } = useAuth()
  const [wslServerUsers, setWslServerUsers] = useState({})
  const [logData, setLogData] = useState([])
  const [filteredLogData, setFilteredLogData] = useState([])
  const [filters, setFilters] = useState({
    user: '',
    command: '',
    date: ''
  })
  const [searchTerm, setSearchTerm] = useState('')

  const applyFilters = useCallback(() => {
    let filtered = [...logData]

    if (userData?.type !== 'admin') {
      const userIps = userData?.ip ? userData.ip.split(';').map(ip => ip.trim()) : []
      filtered = filtered.filter(log => userIps.includes(log.ip))
    }

    if (filters.user && userData?.type === 'admin') {
      filtered = filtered.filter(log => log.ip === filters.user)
    }

    if (filters.command) {
      filtered = filtered.filter(log => log.commandId === filters.command)
    }

    if (filters.date) {
      filtered = filtered.filter(log => log.timestamp.startsWith(filters.date))
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(log => 
        log.command.toLowerCase().includes(term) ||
        (wslServerUsers[log.ip] || '').toLowerCase().includes(term) ||
        log.commandId.includes(term)
      )
    }

    setFilteredLogData(filtered)
  }, [logData, filters, searchTerm, userData, wslServerUsers])

  useEffect(() => {
    if (userData) {
      getWSLServersUsers()
      fetchWSLCommands()
    }
  }, [userData])

  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  async function getWSLServersUsers() {
    const usersRef = collection(db, 'users')
    const usersSnapshot = await getDocs(usersRef)
    const ipToUserMap = {}

    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data()
      const userName = userData.name
      const ipList = userData.ip ? userData.ip.split(';') : []

      ipList.forEach(ip => {
        const trimmedIp = ip.trim()
        if (trimmedIp) {
          ipToUserMap[trimmedIp] = userName
        }
      })
    })

    setWslServerUsers(ipToUserMap)
  }

  async function fetchWSLCommands() {
    try {
      const response = await fetch(`${API_BASE_URL}/wsl/download`)
      if (!response.ok) throw new Error('Failed to fetch log file')
      const logText = await response.text()
      const parsed = parseLogData(logText)
      
      let filtered = parsed
      if (userData.type !== 'admin') {
        const userIps = userData.ip ? userData.ip.split(';').map(ip => ip.trim()) : []
        filtered = parsed.filter(log => userIps.includes(log.ip))
      }
      
      setLogData(filtered.slice(0, 1000))
    } catch (error) {
      console.error('Error fetching WSL command logs:', error)
    }
  }

  function parseLogData(logText) {
    return logText.trim().split('\n')
      .map(line => {
        const parts = line.match(/([\d\.]+) -\s+(\d+)\s+([\d-]+ [\d:]+)\s+(.*)/)
        if (!parts) return null

        return {
          ip: parts[1],
          commandId: parts[2],
          timestamp: parts[3],
          command: parts[4],
          dateTime: DateTime.fromFormat(parts[3], 'yyyy-MM-dd HH:mm:ss')
        }
      })
      .filter(item => item !== null)
      .sort((a, b) => b.dateTime - a.dateTime)
  }

  function convertWSLCommandTime(timestamp) {
    return DateTime.fromFormat(timestamp, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Chicago' })
      .setZone(DateTime.local().zoneName)
      .toFormat('hh:mm a, dd LLL yyyy')
  }

  const uniqueUsers = [...new Set(logData.map(log => log.ip))]
  const uniqueCommands = [...new Set(logData.map(log => log.commandId))]

  return (
    <div className="page-container">
      <Navbar />
      <main className="monitor-main">
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> WSL_COMMANDS_LOG
            </div>
            <input
              type="text"
              id="searchInput"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ marginLeft: 'auto', maxWidth: '200px' }}
            />
          </div>
          <div className="card-content">
          <div className="wsl-filters">
            {userData.type === 'admin' && (
              <div className="filter-group">
                <label htmlFor="userFilter">Filter by User:</label>
                <select
                  id="userFilter"
                  value={filters.user}
                  onChange={(e) => setFilters({ ...filters, user: e.target.value })}
                  className="form-control"
                >
                  <option value="">All Users</option>
                  {uniqueUsers.map(user => (
                    <option key={user} value={user}>{wslServerUsers[user] || user}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="filter-group">
              <label htmlFor="commandFilter">Filter by Command ID:</label>
              <select
                id="commandFilter"
                value={filters.command}
                onChange={(e) => setFilters({ ...filters, command: e.target.value })}
                className="form-control"
              >
                <option value="">All Commands</option>
                {uniqueCommands.map(cmd => (
                  <option key={cmd} value={cmd}>{cmd}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label htmlFor="dateFilter">Filter by Date:</label>
              <input
                type="date"
                id="dateFilter"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                className="form-control"
              />
            </div>
          </div>
          <div className="server-wsl-commands-list">
            {filteredLogData.length > 0 ? (
              <table id="logTable" className="wsl-log-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Command ID</th>
                    <th>Timestamp</th>
                    <th>Command</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogData.map((log, idx) => (
                    <tr key={idx} className={log.command.includes('sudo') ? 'sudo-command' : ''}>
                      <td data-label="User">{wslServerUsers[log.ip] || log.ip}</td>
                      <td data-label="Command ID">{log.commandId}</td>
                      <td data-label="Timestamp">{convertWSLCommandTime(log.timestamp)}</td>
                      <td data-label="Command">{log.command}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="terminal-text">No WSL command logs available.</p>
            )}
          </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Monitor


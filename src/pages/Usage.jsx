import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import { useAuth } from '../contexts/AuthContext'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'
import { API_BASE_URL } from '../config/api'
import toast from 'react-hot-toast'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Usage.css'

function Usage() {
  const { user: userData } = useAuth()
  const [stats, setStats] = useState({})
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState({})
  const [usageByDay, setUsageByDay] = useState({})
  const [timeRange, setTimeRange] = useState('all')

  useEffect(() => {
    if (userData) {
      loadUsage()
    }
  }, [userData])

  useEffect(() => {
    if (rows.length > 0) {
      updateTimeline()
    }
  }, [timeRange, rows])

  async function loadUsage() {
    try {
      const sessionLog = await downloadJson('connection_sessions.json')
      const accessData = await downloadJson('access_codes.json')
      const firestoreUsers = await fetchUsersFromFirestore()

      const { stats: generatedStats, rows: generatedRows, usageByDay: generatedUsageByDay } = generateStats(sessionLog, accessData)

      setStats(generatedStats)
      setRows(generatedRows)
      setUsers(firestoreUsers)
      setUsageByDay(generatedUsageByDay)
    } catch (error) {
      console.error('Error loading usage:', error)
    }
  }

  async function fetchUsersFromFirestore() {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('serverStorage', '>', 0))
    const snapshot = await getDocs(q)
    const usersMap = {}
    snapshot.forEach(doc => {
      usersMap[doc.id] = doc.data()
    })
    return usersMap
  }

  async function downloadJson(filename) {
    const response = await fetch(`${API_BASE_URL}/server/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    })

    if (!response.ok) throw new Error(`Failed to download ${filename}`)
    return await response.json()
  }

  function generateStats(sessionLog, accessData) {
    const stats = {}
    const rows = []
    const usageByDay = {}

    for (const entry of sessionLog) {
      const ip = entry.ip
      const user = matchIpToUser(ip, accessData)
      if (!user) continue

      const key = `${user.name}`
      const t_in = DateTime.fromFormat(entry.in, 'yyyy-MM-dd HH:mm:ss')
      const t_out = entry.out ? DateTime.fromFormat(entry.out, 'yyyy-MM-dd HH:mm:ss') : DateTime.now()
      const duration = t_out.diff(t_in, 'minutes').minutes

      if (!stats[key]) {
        stats[key] = {
          sessions: 0,
          total_minutes: 0,
          ips: new Set(),
          durations: []
        }
      }

      stats[key].sessions++
      stats[key].total_minutes += duration
      stats[key].ips.add(ip)
      stats[key].durations.push(duration)

      rows.push({ user: key, ip, t_in, t_out, duration })

      const day = t_in.toFormat('cccc')
      usageByDay[day] = (usageByDay[day] || 0) + 1
    }

    return { stats, rows, usageByDay }
  }

  function matchIpToUser(ip, accessData) {
    for (const [userId, info] of Object.entries(accessData)) {
      const knownIps = info.ip ? info.ip.split(';') : []
      if (knownIps.includes(ip)) {
        return {
          id: userId,
          name: info.name || `User ${userId}`,
          ssh_folder: info.ssh_folder || 'Unknown'
        }
      }
    }
    return null
  }

  function updateTimeline() {
    const now = DateTime.now()
    let filteredRows

    switch (timeRange) {
      case 'day':
        const dayAgo = now.minus({ days: 1 })
        filteredRows = rows.filter(r => r.t_in >= dayAgo)
        break
      case 'week':
        const weekAgo = now.minus({ weeks: 1 })
        filteredRows = rows.filter(r => r.t_in >= weekAgo)
        break
      case 'month':
        const monthAgo = now.minus({ months: 1 })
        filteredRows = rows.filter(r => r.t_in >= monthAgo)
        break
      default:
        filteredRows = rows
    }

    return filteredRows
  }

  const filteredRows = updateTimeline()
  const usersList = Object.keys(stats)
  const sessionCounts = usersList.map(u => stats[u].sessions)
  const totalHours = usersList.map(u => (stats[u].total_minutes / 60).toFixed(2))
  const storageSizes = usersList.map(u => {
    const firestoreUser = Object.values(users).find(user => user.name === u)
    return ((firestoreUser?.serverStorage || 0) / 1024).toFixed(2)
  })

  const maxSessions = Math.max(...sessionCounts, 1)
  const maxHours = Math.max(...totalHours.map(h => parseFloat(h)), 1)
  const maxStorage = Math.max(...storageSizes.map(s => parseFloat(s)), 1)

  const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const maxDayUsage = Math.max(...Object.values(usageByDay), 1)

  return (
    <div className="page-container">
      <Navbar />
      <main className="dashboard-main">
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Overview</span>
              <h2>Usage summary</h2>
              <p>Session counts, connected time, and storage per user.</p>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          <div className="usage-summary">
            {usersList.map((user, idx) => {
              const data = stats[user]
              const totalMinutes = Math.floor(data.total_minutes)
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              const firestoreUser = Object.values(users).find(u => u.name === user)
              const storage = ((firestoreUser?.serverStorage || 0) / 1024).toFixed(2)

              return (
                <div key={idx} className="user-summary">
                  <h4>{user}</h4>
                  <p>Total Sessions: {data.sessions}</p>
                  <p>Total Time: {hours}h {minutes}m</p>
                  <p>IPs Used: {[...data.ips].join(', ')}</p>
                  <p>Storage: {storage} GB</p>
                </div>
              )
            })}
          </div>
          </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Sessions</span>
              <h2>Sessions per user</h2>
              <p>Connection count by user.</p>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          {usersList.map((user, i) => (
            <div key={i} className="bar-row">
              <div className="bar-label">{user}</div>
              <div className="bar-track">
                <div className="bar-fill animate-bar" style={{ width: `${(sessionCounts[i] / maxSessions) * 100}%` }} title={`${sessionCounts[i]} sessions`}></div>
                <span className="bar-value">{sessionCounts[i]}</span>
              </div>
            </div>
          ))}
          </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Time</span>
              <h2>Connected time</h2>
              <p>Total hours connected per user.</p>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          {usersList.map((user, i) => (
            <div key={i} className="bar-row">
              <div className="bar-label">{user}</div>
              <div className="bar-track">
                <div className="bar-fill animate-bar" style={{ width: `${(parseFloat(totalHours[i]) / maxHours) * 100}%` }} title={`${totalHours[i]} hours`}></div>
                <span className="bar-value">{totalHours[i]}</span>
              </div>
            </div>
          ))}
          </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Storage</span>
              <h2>Storage used</h2>
              <p>Disk usage per user in GB.</p>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          {usersList.map((user, i) => (
            <div key={i} className="bar-row">
              <div className="bar-label">{user}</div>
              <div className="bar-track">
                <div className="bar-fill animate-bar" style={{ width: `${(parseFloat(storageSizes[i]) / maxStorage) * 100}%` }} title={`${storageSizes[i]} GB`}></div>
                <span className="bar-value">{storageSizes[i]}</span>
              </div>
            </div>
          ))}
          </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Timeline</span>
              <h2>Session timeline</h2>
              <p>Connection sessions over time by user.</p>
            </div>
            <div className="timeline-filters">
              <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)} className="form-control">
                <option value="day">Last 24 Hours</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          <div className="timeline-wrapper">
            {(() => {
              const uniqueUsers = [...new Set(filteredRows.map(r => r.user))]
              const minTime = Math.min(...filteredRows.map(r => r.t_in.toMillis()))
              const maxTime = Math.max(...filteredRows.map(r => r.t_out.toMillis()))
              const totalSpan = maxTime - minTime

              return uniqueUsers.map(user => (
                <div key={user} className="timeline-row">
                  <div className="timeline-label">{user}</div>
                  <div className="timeline-track">
                    {filteredRows.filter(r => r.user === user).map((session, idx) => {
                      const start = session.t_in.toMillis()
                      const end = session.t_out.toMillis()
                      const leftPercent = ((start - minTime) / totalSpan) * 100
                      const widthPercent = ((end - start) / totalSpan) * 100

                      return (
                        <div
                          key={idx}
                          className="timeline-bar animate-bar"
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          title={`${session.t_in.toFormat('dd MMM yyyy, hh:mm a')} - ${session.t_out.toFormat('dd MMM yyyy, hh:mm a')}`}
                        />
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
          </div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Activity</span>
              <h2>Most active days</h2>
              <p>Session count by weekday.</p>
            </div>
          </div>
          <div className="server-card">
            <div className="card-content">
          {orderedDays.map(day => {
            const count = usageByDay[day] || 0
            return (
              <div key={day} className="bar-row">
                <div className="bar-label">{day}</div>
                <div className="bar-track">
                  <div className="bar-fill animate-bar" style={{ width: `${(count / maxDayUsage) * 100}%` }} title={`${count} sessions`}></div>
                  <span className="bar-value">{count}</span>
                </div>
              </div>
            )
          })}
          </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default Usage

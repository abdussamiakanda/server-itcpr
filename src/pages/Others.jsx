import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import { useAuth } from '../contexts/AuthContext'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { API_BASE_URL } from '../config/api'
import { Cpu, HardDrive, Thermometer } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './Others.css'

function Others() {
  const { user: userData } = useAuth()
  const [serverDataBeta, setServerDataBeta] = useState(null)
  const [isServerOnlineBeta, setIsServerOnlineBeta] = useState(false)

  useEffect(() => {
    if (userData) {
      fetchServerData()
      const interval = setInterval(fetchServerData, 20000)
      return () => clearInterval(interval)
    }
  }, [userData])

  async function fetchServerData() {
    try {
      const responseBeta = await fetch(`${API_BASE_URL}/server/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'server_stats_beta.json' })
      })

      if (!responseBeta.ok) throw new Error('Network response was not ok')

      const data = await responseBeta.json()
      setServerDataBeta(data)

      const daysBeta = Math.floor(data.uptime.hours / 24)
      const hoursBeta = data.uptime.hours % 24

      let parsedTimeBeta = null
      if (DateTime.local().zoneName !== 'Asia/Dhaka') {
        parsedTimeBeta = DateTime.fromFormat(data.last_updated, 'hh:mm a; LLLL dd, yyyy', { zone: 'Asia/Dhaka', locale: 'en-US' }).setZone(DateTime.local().zoneName)
      } else {
        parsedTimeBeta = DateTime.fromFormat(data.last_updated, 'hh:mm a; LLLL dd, yyyy', { zone: 'Asia/Dhaka', locale: 'en-US' })
      }

      const now = DateTime.local()
      const diffInMinutesBeta = now.diff(parsedTimeBeta, 'minutes').toObject().minutes

      setIsServerOnlineBeta(diffInMinutesBeta <= 2)
    } catch (error) {
      console.error('Error loading server content:', error)
    }
  }

  async function getServerCredentials() {
    const serverRef = collection(db, 'servers')
    const serverSnapshot = await getDocs(serverRef)
    return serverSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  }

  const [serverCredentials, setServerCredentials] = useState([])

  useEffect(() => {
    if (userData?.lab) {
      getServerCredentials().then(setServerCredentials)
    }
  }, [userData])

  if (!userData || !serverDataBeta) {
    return (
      <div className="page-container">
        <Navbar />
        <main className="others-main">
          <div className="server-card">
            <div className="card-header">
              <div className="terminal-window-controls">
                <span className="control-dot red"></span>
                <span className="control-dot yellow"></span>
                <span className="control-dot green"></span>
              </div>
              <div className="card-title">
                <span className="code-symbol">$</span> LOADING...
              </div>
            </div>
            <div className="card-content">
              <p className="terminal-text">Initializing server connection...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const daysBeta = Math.floor(serverDataBeta.uptime.hours / 24)
  const hoursBeta = serverDataBeta.uptime.hours % 24

  const userServers = serverCredentials.filter(
    server => userData.lab?.includes(server.lab) && server.username === 'spintronics'
  )

  return (
    <div className="page-container">
      <Navbar />
      <main className="others-main">
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> BETA_SERVER_INFO
            </div>
          </div>
          <div className="card-content">
            <div className="server-stats-grid">
            {!isServerOnlineBeta ? (
              <div className="server-offline-message">
                <p>The server is currently powered off.</p>
                <p className="sub-text">Contact us to power it on.</p>
              </div>
            ) : (
              <>
                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <Cpu className="stat-icon-server" size={20} />
                    <span className="stat-title-server">Server Memory</span>
                  </div>
                  <div className="stat-value-server">{serverDataBeta.memory.percent_used}</div>
                  <div className="stat-info-server">Used: {serverDataBeta.memory.used} / {serverDataBeta.memory.total}</div>
                </div>

                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <HardDrive className="stat-icon-server" size={20} />
                    <span className="stat-title-server">Server Storage</span>
                  </div>
                  <div className="stat-value-server">{serverDataBeta.disk.percent_used}</div>
                  <div className="stat-info-server">Used: {serverDataBeta.disk.used} / {serverDataBeta.disk.total}</div>
                </div>

                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <Thermometer className="stat-icon-server" size={20} />
                    <span className="stat-title-server">Server Temperature</span>
                  </div>
                  <div className="stat-value-server">{serverDataBeta.cpu_temperature}° C</div>
                  <div className="stat-info-server">Uptime: {daysBeta} days, {hoursBeta} hours</div>
                </div>
              </>
            )}
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
              <span className="code-symbol">$</span> ACCESS_INFORMATION
            </div>
          </div>
          <div className="card-content">
            <p className="terminal-text">
              These are external servers that are maintained by ITCPR for technical support
              and administration. Access is granted exclusively to authorized direct students,
              who may also use ITCPR's primary server when required.
            </p>
            {userData.lab && userServers.length > 0 && (
              <div className="server-access">
                <p className="terminal-text">You have access to these servers with the following credentials:</p>
                <div className="server-credentials">
                  {userServers.map((server, idx) => (
                    <ul key={idx}>
                      <li><b>Server/PC:</b> {server.pc}</li>
                      <li><b>Network:</b> {server.network}</li>
                      <li><b>Username:</b> {server.username}</li>
                      <li><b>Password:</b> {server.password}</li>
                      <li><b>Owner:</b> {server.owner}</li>
                    </ul>
                  ))}
                </div>
                <div className="note">
                  <small>**Note: Please keep your credentials secure and do not share them with anyone.</small>
                  <br />
                  <small>**Network: This is the zerotier network ID.</small>
                </div>
                <div className="server-guide">
                  If you're joining the server for the first time, after you join the zerotier network,
                  contact us to get authorization. After that, you can access the server using the provided credentials.
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default Others


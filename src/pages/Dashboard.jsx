import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { collection, getDocs, doc, getDoc, updateDoc, deleteField, query, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'
import { API_BASE_URL, PORTAL_GUIDE_URL } from '../config/api'
import { sendEmail, getEmailTemplate } from '../services/email'
import { authenticateZeroTierMember, deauthenticateZeroTierMember } from '../services/zerotier'
import { Server, HardDrive, Thermometer, Users, Key, Copy, Trash2, Check, X, Edit, Link as LinkIcon } from 'lucide-react'
import Navbar from '../components/Navbar'
import Modal, { ModalHeader, ModalBody, ModalFooter } from '../components/Modal'
import ConfirmDialog from '../components/ConfirmDialog'
import './Dashboard.css'

function Dashboard() {
  const { user: userData } = useAuth()
  const [serverData, setServerData] = useState(null)
  const [isServerOnline, setIsServerOnline] = useState(false)
  const [serverUsers, setServerUsers] = useState([])
  const [resilioUsers, setResilioUsers] = useState([])
  const [serverRequests, setServerRequests] = useState([])
  const [wslServerUsers, setWslServerUsers] = useState({})
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [showResilioModal, setShowResilioModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({ zerotierId: '', userId: '', resilioLink: '', ip: '', serverCode: '', ssh_folder: '' })
  const [availableUsers, setAvailableUsers] = useState([])
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null })

  useEffect(() => {
    if (userData) {
      getWSLServersUsers()
      fetchServerData()
      if (userData.type === 'admin') {
        loadAvailableUsers()
      }
      const interval = setInterval(fetchServerData, 20000)
      return () => clearInterval(interval)
    }
  }, [userData])

  useEffect(() => {
    if (userData && serverData) {
      getServerUsers(serverData.active_connections)
      loadResilioUsers()
      if (userData.type === 'admin') {
        loadServerRequests()
      }
    }
  }, [userData, serverData])

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

  async function fetchServerData() {
    try {
      const response = await fetch(`${API_BASE_URL}/server/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: 'server_stats.json' })
      })

      if (!response.ok) throw new Error('Network response was not ok')

      const data = await response.json()
      setServerData(data)

      const days = Math.floor(data.uptime.hours / 24)
      const hours = data.uptime.hours % 24

      let parsedTime = null
      if (DateTime.local().zoneName !== 'America/Chicago') {
        parsedTime = DateTime.fromFormat(data.last_updated, 'hh:mm a; LLLL dd, yyyy', { zone: 'America/Chicago', locale: 'en-US' }).setZone(DateTime.local().zoneName)
      } else {
        parsedTime = DateTime.fromFormat(data.last_updated, 'hh:mm a; LLLL dd, yyyy', { zone: 'America/Chicago', locale: 'en-US' })
      }

      const now = DateTime.local()
      const diffInMinutes = now.diff(parsedTime, 'minutes').toObject().minutes

      setIsServerOnline(diffInMinutes <= 2)
    } catch (error) {
      console.error('Error loading server content:', error)
    }
  }

  async function getServerUsers(activeConnections) {
    const usersRef = collection(db, 'users')
    const usersSnapshot = await getDocs(usersRef)
    const users = usersSnapshot.docs.map(doc => doc.data())

    const activeIps = new Set(Object.keys(activeConnections))
    const connectedUsers = []

    for (const user of users) {
      if (user.ip) {
        const userIps = user.ip.split(';')
        const isConnected = userIps.some(ip => activeIps.has(ip))

        if (isConnected && isServerOnline) {
          const connectedIp = userIps.find(ip => activeIps.has(ip))
          const conn = activeConnections[connectedIp]
          connectedUsers.push({
            name: user.name,
            connectedAt: convertToLocalTime(conn.connected_at),
            port: conn.port === 22 ? 'SSH' : 'Remote Desktop'
          })
        }
      }
    }

    setServerUsers(connectedUsers)
  }

  async function loadResilioUsers() {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('name', 'asc'))
    const userSnap = await getDocs(q)

    const users = []
    userSnap.docs.forEach(doc => {
      const user = doc.data()
      if (user.resilio && (userData.type === 'admin' || userData.uid === doc.id)) {
        users.push({ id: doc.id, ...user })
      }
    })

    setResilioUsers(users)
  }

  async function loadServerRequests() {
    const usersRef = collection(db, 'users')
    const q = query(usersRef, orderBy('name', 'asc'))
    const usersSnapshot = await getDocs(q)
    const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

    const requests = []
    for (const user of users) {
      if (user.zerotierId && !user.ip) {
        requests.push({ ...user, status: 'pending' })
      } else if (user.ip && user.zerotierId) {
        requests.push({ ...user, status: 'approved' })
      }
    }

    setServerRequests(requests)
  }

  async function handleRequestAccess() {
    if (!formData.zerotierId || formData.zerotierId.trim() === '') {
      toast.error('Please enter your ZeroTier ID.')
      return
    }

    try {
      const userRef = doc(db, 'users', userData.uid)
      await updateDoc(userRef, { zerotierId: formData.zerotierId })
      await sendEmail(userData.email, 'Server Access Request', getEmailTemplate(userData.name, `
        <p>Your request for server access has been received. Please wait for approval.</p>
        <p>You will receive an email when your access is approved and an IP address is assigned.</p>
        <p>Your ZeroTier ID: <b>${formData.zerotierId}</b></p>
      `))
      await sendEmail('abdussamiakanda@gmail.com', 'Server Access Request', getEmailTemplate('Md Abdus Sami Akanda', `
        <p>${userData.name} has requested server access.</p>
        <p>ZeroTier ID: <b>${formData.zerotierId}</b></p>
        <p>Please review and approve or reject the request.</p>
      `))
      setShowAccessModal(false)
      setFormData({ ...formData, zerotierId: '' })
      loadServerRequests()
      toast.success('Access request submitted successfully')
    } catch (error) {
      console.error('Error requesting access:', error)
      toast.error('Error submitting request. Please try again.')
    }
  }

  async function handleApproveRequest() {
    if (!formData.ip || !formData.serverCode || !formData.ssh_folder) {
      toast.error('Please fill in all fields.')
      return
    }
    if (!selectedUser) return

    try {
      const userRef = doc(db, 'users', selectedUser.id)
      const user = await getDoc(userRef)
      await updateDoc(userRef, {
        ip: formData.ip,
        serverCode: formData.serverCode,
        ssh_folder: formData.ssh_folder
      })
      await sendEmail(user.data().email, 'Server Access Request', getEmailTemplate(user.data().name, `
        <p>Your request for server access has been approved.</p>
        <p>
          <b>Your Credentials:</b>
          <ul>
            <li>IP Address: ${formData.ip}</li>
            <li>Access Code: ${formData.serverCode}</li>
            <li>SSH Folder Name: ${formData.ssh_folder}</li>
          </ul>
        </p>
        <p>Please refer to the <a href={PORTAL_GUIDE_URL}>Remote Server User Guide</a> for detailed instructions on using the server. Access will be available within a few minutes.</p>
      `))
      await authenticateZeroTierMember(user.data().zerotierId, formData.ip, formData.ssh_folder)
      await updateAccessCodeJson()
      setShowApproveModal(false)
      setSelectedUser(null)
      setFormData({ ...formData, ip: '', serverCode: '', ssh_folder: '' })
      loadServerRequests()
      toast.success('Server access approved successfully')
    } catch (error) {
      console.error('Error approving request:', error)
      toast.error('Error approving request. Please try again.')
    }
  }

  async function handleRejectRequest(uid) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Request',
      message: 'Are you sure you want to delete this request?',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', uid)
          const user = await getDoc(userRef)
          await sendEmail(user.data().email, 'Server Access Request', getEmailTemplate(user.data().name, `
            <p>Your request for server access has been deleted.</p>
            <p>Please contact the admin for more information.</p>
          `))
          await updateDoc(userRef, { zerotierId: deleteField() })
          loadServerRequests()
          toast.success('Request deleted successfully')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (error) {
          console.error('Error rejecting request:', error)
          toast.error('Error deleting request. Please try again.')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  async function handleRevokeAccess(uid) {
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke Access',
      message: 'Are you sure you want to revoke access for this user?',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', uid)
          const user = await getDoc(userRef)
          await updateDoc(userRef, {
            ip: deleteField(),
            serverCode: deleteField(),
            ssh_folder: deleteField()
          })
          await sendEmail(user.data().email, 'Server Access Revoked', getEmailTemplate(user.data().name, `
            <p>Your server access has been revoked.</p>
            <p>Please contact the admin for more information.</p>
          `))
          await deauthenticateZeroTierMember(user.data().zerotierId)
          await updateAccessCodeJson()
          loadServerRequests()
          toast.success('Access revoked successfully')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (error) {
          console.error('Error revoking access:', error)
          toast.error('Error revoking access. Please try again.')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  async function handleAddResilio() {
    if (!formData.userId || !formData.resilioLink || formData.resilioLink.trim() === '') {
      toast.error('Please fill in all fields.')
      return
    }

    try {
      const userRef = doc(db, 'users', formData.userId)
      await updateDoc(userRef, { resilio: formData.resilioLink })
      setShowResilioModal(false)
      setFormData({ ...formData, userId: '', resilioLink: '' })
      loadResilioUsers()
      loadAvailableUsers()
      toast.success('Resilio Sync link added successfully')
    } catch (error) {
      console.error('Error adding Resilio Sync link:', error)
      toast.error('Error adding Resilio Sync link. Please try again.')
    }
  }

  async function handleRemoveResilio(uid) {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Resilio Sync Link',
      message: 'Are you sure you want to remove this Resilio Sync link?',
      onConfirm: async () => {
        try {
          const userRef = doc(db, 'users', uid)
          await updateDoc(userRef, { resilio: deleteField() })
          loadResilioUsers()
          toast.success('Resilio Sync link removed successfully')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        } catch (error) {
          console.error('Error removing Resilio Sync link:', error)
          toast.error('Error removing Resilio Sync link. Please try again.')
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })
        }
      }
    })
  }

  async function copyResilioToClip(link) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Resilio Sync link copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy link to clipboard')
    }
  }

  async function getNewUserCodes() {
    const usersRef = collection(db, 'users')
    const userSnap = await getDocs(usersRef)
    const users = userSnap.docs.map(doc => doc.data())

    const usedIPs = new Set()
    const usedCodes = new Set()

    for (const user of users) {
      if (user.ip) {
        const baseIP = user.ip.split(';')[0]
        usedIPs.add(baseIP)
      }
      if (user.serverCode) {
        usedCodes.add(user.serverCode)
      }
    }

    const subnetPrefix = '10.144.172.'
    let nextAvailable = 10
    let newUserCode

    while (nextAvailable < 255) {
      const candidateIP = subnetPrefix + nextAvailable
      if (!usedIPs.has(candidateIP)) {
        var newUserIP = candidateIP
        break
      }
      nextAvailable++
    }

    do {
      newUserCode = Math.floor(1000 + Math.random() * 9000).toString()
    } while (usedCodes.has(newUserCode))

    return { newUserIP, newUserCode }
  }

  async function openApproveModal(user) {
    const { newUserIP, newUserCode } = await getNewUserCodes()
    setSelectedUser(user)
    setFormData({ ...formData, ip: newUserIP, serverCode: newUserCode, ssh_folder: '' })
    setShowApproveModal(true)
  }

  async function openEditModal(user) {
    setSelectedUser(user)
    setFormData({ ...formData, ip: user.ip, serverCode: user.serverCode, ssh_folder: user.ssh_folder })
    setShowEditModal(true)
  }

  async function handleUpdateAccess() {
    if (!formData.ip || !formData.serverCode || !formData.ssh_folder) {
      toast.error('Please fill in all fields.')
      return
    }
    if (!selectedUser) return

    try {
      const userRef = doc(db, 'users', selectedUser.id)
      await updateDoc(userRef, {
        ip: formData.ip,
        serverCode: formData.serverCode,
        ssh_folder: formData.ssh_folder
      })
      await updateAccessCodeJson()
      setShowEditModal(false)
      setSelectedUser(null)
      setFormData({ ...formData, ip: '', serverCode: '', ssh_folder: '' })
      loadServerRequests()
      toast.success('Access updated successfully')
    } catch (error) {
      console.error('Error updating access:', error)
      toast.error('Error updating access. Please try again.')
    }
  }

  async function updateAccessCodeJson() {
    const usersRef = collection(db, 'users')
    const usersSnapshot = await getDocs(usersRef)
    const accessCodes = {}

    usersSnapshot.docs.forEach(doc => {
      const serverUserData = doc.data()
      const userName = serverUserData.name
      const ip = serverUserData.ip
      const ssh_folder = serverUserData.ssh_folder

      if (serverUserData.serverCode && ip) {
        accessCodes[serverUserData.serverCode] = {
          name: userName,
          ip: ip,
          ssh_folder: ssh_folder
        }
      }
    })

    const jsonString = JSON.stringify(accessCodes, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const formData = new FormData()
    formData.append('file', blob, 'access_codes.json')

    try {
      const response = await fetch(`${API_BASE_URL}/server/access`, {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      if (response.ok) {
        console.log('Access codes uploaded successfully:', result.message)
      } else {
        console.error('Upload failed:', result.error)
      }
    } catch (error) {
      console.error('Upload error:', error)
    }
  }

  async function loadAvailableUsers() {
    const usersRef = collection(db, 'users')
    const userSnap = await getDocs(usersRef)
    const users = []
    userSnap.docs.forEach(doc => {
      const user = doc.data()
      if (!user.resilio) {
        users.push({ id: doc.id, name: user.name, group: user.group })
      }
    })
    setAvailableUsers(users)
  }

  function convertToLocalTime(input, gmtOffset = 'GMT-6') {
    const inputWithOffset = `${input} ${gmtOffset}`
    const date = new Date(inputWithOffset)
    const timeString = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const dateString = date.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
    return `${timeString}, ${dateString}`
  }

  if (!userData || !serverData) {
    return (
      <div className="page-container">
        <Navbar />
        <main className="dashboard-main">
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

  const days = Math.floor(serverData.uptime.hours / 24)
  const hours = serverData.uptime.hours % 24

  return (
    <div className="page-container">
      <Navbar />
      <main className="dashboard-main">
        {/* Server Status Card */}
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> ALPHA_SERVER_STATUS
            </div>
            <div className={`server-status-badge ${isServerOnline ? 'online' : 'offline'}`}>
              <div className="status-dot"></div>
              {isServerOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <div className="card-content">
            {!isServerOnline ? (
              <div className="server-offline-message">
                <Server size={48} className="offline-icon" />
                <p>The server is currently powered off.</p>
                <p className="sub-text">Contact us to power it on.</p>
              </div>
            ) : (
              <div className="server-stats-grid">
                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <HardDrive size={24} className="stat-icon-server" />
                    <span className="stat-title-server">Memory</span>
                  </div>
                  <div className="stat-value-server">{serverData.memory.percent_used}</div>
                  <div className="stat-info-server">
                    <span className="terminal-prompt">Used:</span> {serverData.memory.used} / {serverData.memory.total}
                  </div>
                </div>

                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <HardDrive size={24} className="stat-icon-server" />
                    <span className="stat-title-server">Storage</span>
                  </div>
                  <div className="stat-value-server">{serverData.disk.percent_used}</div>
                  <div className="stat-info-server">
                    <span className="terminal-prompt">Used:</span> {serverData.disk.used} / {serverData.disk.total}
                  </div>
                </div>

                <div className="stat-card-server">
                  <div className="stat-header-server">
                    <Thermometer size={24} className="stat-icon-server" />
                    <span className="stat-title-server">Temperature</span>
                  </div>
                  <div className="stat-value-server">{serverData.cpu_temperature}°C</div>
                  <div className="stat-info-server">
                    <span className="terminal-prompt">Uptime:</span> {days}d {hours}h
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Server Access Card */}
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">#</span> SERVER_ACCESS
            </div>
            {!userData.serverCode && (
              <button className="server-btn-small" onClick={() => setShowAccessModal(true)}>
                Request Access
              </button>
            )}
          </div>
          <div className="card-content">
            {userData.serverCode ? (
              <div className="access-credentials">
                <p className="terminal-line-text">
                  <span className="terminal-prompt">$</span> Access granted. Your credentials:
                </p>
                <div className="credentials-list">
                  <div className="credential-item">
                    <div className="cred-label-wrapper">
                      <Key size={16} />
                      <span className="cred-label">Access Code:</span>
                    </div>
                    <code className="cred-value">{userData.serverCode}</code>
                  </div>
                  <div className="credential-item">
                    <div className="cred-label-wrapper">
                      <Server size={16} />
                      <span className="cred-label">IP Address:</span>
                    </div>
                    <code className="cred-value">{userData.ip?.replaceAll(';', ', ')}</code>
                  </div>
                  <div className="credential-item">
                    <div className="cred-label-wrapper">
                      <HardDrive size={16} />
                      <span className="cred-label">SSH Folder:</span>
                    </div>
                    <code className="cred-value">{window.innerWidth > 700 ? `/mnt/c/Users/info/Research/${userData.ssh_folder}` : `.../Research/${userData.ssh_folder}`}</code>
                  </div>
                </div>
              </div>
            ) : (
              <p className="terminal-output">You do not have access to the server. Please request access.</p>
            )}
          </div>
        </div>

        {/* Active Connections */}
        <div className="server-card">
          <div className="card-header">
            <div className="terminal-window-controls">
              <span className="control-dot red"></span>
              <span className="control-dot yellow"></span>
              <span className="control-dot green"></span>
            </div>
            <div className="card-title">
              <span className="code-symbol">$</span> ACTIVE_CONNECTIONS
            </div>
          </div>
          <div className="card-content">
            <div className="connections-table-wrapper">
              <table className="server-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Last Connected</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {serverUsers.length > 0 ? (
                    serverUsers.map((user, idx) => (
                      <tr key={idx}>
                        <td data-label="User">
                          <Users size={16} className="table-icon" />
                          {user.name}
                        </td>
                        <td data-label="Last Connected" className="monospace">{user.connectedAt}</td>
                        <td data-label="Type">
                          <span className="connection-badge">{user.port}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="no-data">No active connections</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resilio Sync */}
        {(userData.type === 'admin' || userData.resilio) && (
          <div className="server-card">
            <div className="card-header">
              <div className="terminal-window-controls">
                <span className="control-dot red"></span>
                <span className="control-dot yellow"></span>
                <span className="control-dot green"></span>
              </div>
              <div className="card-title">
                <span className="code-symbol">$</span> RESILIO_SYNC
              </div>
              {userData.type === 'admin' && (
                <button className="server-btn-small" onClick={() => {
                  loadAvailableUsers()
                  setShowResilioModal(true)
                }}>
                  Add User
                </button>
              )}
            </div>
            <div className="card-content">
              <p className="terminal-output">
                Access your files and sync to your personal computer from the server using the Resilio Sync app.
                <br />
                <a className="server-link" target="_blank" rel="noopener noreferrer" href={PORTAL_GUIDE_URL}>
                  <LinkIcon size={14} /> Remote Server User Guide
                </a>
              </p>
              <div className="resilio-list">
                {resilioUsers.map(user => (
                  <div key={user.id} className="resilio-item">
                    <div className="resilio-info">
                      <Users size={16} />
                      <span className="resilio-name">{user.name}</span>
                      <code className="resilio-link">{user.resilio}</code>
                    </div>
                    <div className="resilio-actions">
                      {userData.type === 'admin' && (
                        <button className="icon-btn" onClick={() => handleRemoveResilio(user.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button className="icon-btn" onClick={() => copyResilioToClip(user.resilio)} title="Copy">
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Connection Requests (Admin Only) */}
        {userData.type === 'admin' && (
          <div className="server-card">
            <div className="card-header">
              <div className="terminal-window-controls">
                <span className="control-dot red"></span>
                <span className="control-dot yellow"></span>
                <span className="control-dot green"></span>
              </div>
              <div className="card-title">
                <span className="code-symbol">#</span> CONNECTION_REQUESTS
              </div>
            </div>
            <div className="card-content">
              <div className="requests-grid">
                {serverRequests.map(user => (
                  <div key={user.id} className={`request-card ${user.status === 'pending' ? 'pending' : ''}`}>
                    <div className="request-header">
                      <Users size={20} />
                      <div>
                        <div className="request-name">{user.name}</div>
                        <div className="request-id">ZeroTier: {user.zerotierId}</div>
                      </div>
                    </div>
                    <div className="request-actions">
                      {user.status === 'pending' ? (
                        <>
                          <button className="server-btn-action success" onClick={() => openApproveModal(user)}>
                            <Check size={16} />
                            Approve
                          </button>
                          <button className="server-btn-action danger" onClick={() => handleRejectRequest(user.id)}>
                            <X size={16} />
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="server-btn-action success" onClick={() => openEditModal(user)}>
                            <Edit size={16} />
                            Edit
                          </button>
                          <button className="server-btn-action danger" onClick={() => handleRevokeAccess(user.id)}>
                            <X size={16} />
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals remain the same */}
      <Modal isOpen={showAccessModal} onClose={() => setShowAccessModal(false)}>
        <ModalHeader onClose={() => setShowAccessModal(false)}>
          <h3>Request Server Access</h3>
        </ModalHeader>
        <ModalBody>
          <div className="form-group">
            <p>
              Access to the server is limited to authorized users only.
              Please familiarize yourself with how to use the server and its resources.
              Join the ITCPR ZeroTier network after downloading the ZeroTier
              Client app and using your ZeroTier ID.
            </p>
          </div>
          <div className="form-group">
            <label htmlFor="zerotierId">ZeroTier Address</label>
            <input
              type="text"
              id="zerotierId"
              className="form-control"
              value={formData.zerotierId}
              onChange={(e) => setFormData({ ...formData, zerotierId: e.target.value })}
              required
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="modal-btn secondary" onClick={() => setShowAccessModal(false)}>Cancel</button>
          <button className="modal-btn primary" onClick={handleRequestAccess}>Request Access</button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showResilioModal} onClose={() => setShowResilioModal(false)}>
        <ModalHeader onClose={() => setShowResilioModal(false)}>
          <h3>Add Resilio Sync User</h3>
        </ModalHeader>
        <ModalBody>
          <div className="form-group">
            <label htmlFor="userId">Select User</label>
            <select
              id="userId"
              className="form-control"
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
            >
              <option value="">Select a user...</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.group?.charAt(0).toUpperCase() + user.group?.slice(1)})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="resilioLink">Resilio Sync URL</label>
            <input
              type="text"
              id="resilioLink"
              className="form-control"
              placeholder="Enter Resilio Sync URL..."
              value={formData.resilioLink}
              onChange={(e) => setFormData({ ...formData, resilioLink: e.target.value })}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="modal-btn secondary" onClick={() => setShowResilioModal(false)}>Cancel</button>
          <button className="modal-btn primary" onClick={handleAddResilio}>Add Link</button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)}>
        <ModalHeader onClose={() => setShowApproveModal(false)}>
          <h3>Approve Server Access Request</h3>
        </ModalHeader>
        <ModalBody>
          <div className="form-group">
            <label htmlFor="ip">IP Address</label>
            <input
              type="text"
              id="ip"
              className="form-control"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="server_code">Access Code</label>
            <input
              type="text"
              id="server_code"
              className="form-control"
              value={formData.serverCode}
              onChange={(e) => setFormData({ ...formData, serverCode: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="ssh_folder">SSH Folder Name</label>
            <input
              type="text"
              id="ssh_folder"
              className="form-control"
              value={formData.ssh_folder}
              onChange={(e) => setFormData({ ...formData, ssh_folder: e.target.value })}
              required
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="modal-btn secondary" onClick={() => setShowApproveModal(false)}>Cancel</button>
          <button className="modal-btn primary" onClick={handleApproveRequest}>Approve</button>
        </ModalFooter>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <ModalHeader onClose={() => setShowEditModal(false)}>
          <h3>Edit Server Access</h3>
        </ModalHeader>
        <ModalBody>
          <div className="form-group">
            <label htmlFor="edit_ip">IP Address</label>
            <input
              type="text"
              id="edit_ip"
              className="form-control"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit_server_code">Access Code</label>
            <input
              type="text"
              id="edit_server_code"
              className="form-control"
              value={formData.serverCode}
              onChange={(e) => setFormData({ ...formData, serverCode: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit_ssh_folder">SSH Folder Name</label>
            <input
              type="text"
              id="edit_ssh_folder"
              className="form-control"
              value={formData.ssh_folder}
              onChange={(e) => setFormData({ ...formData, ssh_folder: e.target.value })}
              required
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="modal-btn secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
          <button className="modal-btn primary" onClick={handleUpdateAccess}>Update</button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  )
}

export default Dashboard

import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { collection, getDocs, doc, getDoc, updateDoc, deleteField, query, orderBy, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { API_BASE_URL, PORTAL_GUIDE_URL, ZEROTIER_NETWORK_ID } from '../config/api'
import { sendEmail, getEmailTemplate } from '../services/email'
import { authenticateZeroTierMember, deauthenticateZeroTierMember } from '../services/zerotier'
import { Server, HardDrive, Cpu, Thermometer, Users, Key, Copy, Trash2, Check, X, Edit, Link as LinkIcon, Loader2, Plus } from 'lucide-react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
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
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [isAddingResilio, setIsAddingResilio] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [isUpdatingAccess, setIsUpdatingAccess] = useState(false)
  const [confirmDialogLoading, setConfirmDialogLoading] = useState(false)
  const [openingApproveModalId, setOpeningApproveModalId] = useState(null)
  const [bookings, setBookings] = useState([])
  const [bookingForm, setBookingForm] = useState({ date: '', startTime: '09:00', endTime: '12:00', purpose: '' })
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)

  useEffect(() => {
    if (userData) {
      getWSLServersUsers()
      fetchServerData()
      loadBookings()
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
    const zerotierValue = formData.zerotierId.trim().slice(0, 10)
    if (zerotierValue.length >= 10 && ZEROTIER_NETWORK_ID && zerotierValue === ZEROTIER_NETWORK_ID.slice(0, 10)) {
      toast.error('That\'s the network ID, not your address. Please enter your ZeroTier member address.')
      return
    }

    setIsRequestingAccess(true)
    try {
      const userRef = doc(db, 'users', userData.uid)
      await updateDoc(userRef, { zerotierId: formData.zerotierId })
      await sendEmail(userData.email, 'Server Access Request', getEmailTemplate(userData.name, `
        <p>Your request for server access has been received. Please wait for approval.</p>
        <p>You will receive an email when your access is approved and an IP address is assigned.</p>
        <p>Your ZeroTier ID: <b>${formData.zerotierId}</b></p>
      `))
      await sendEmail('masakanda@mail.itcpr.org', 'Server Access Request', getEmailTemplate('Md Abdus Sami Akanda', `
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
    } finally {
      setIsRequestingAccess(false)
    }
  }

  async function handleApproveRequest() {
    if (!formData.ip || !formData.serverCode || !formData.ssh_folder) {
      toast.error('Please fill in all fields.')
      return
    }
    if (!selectedUser) return

    setIsApproving(true)
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
    } finally {
      setIsApproving(false)
    }
  }

  async function handleRejectRequest(uid) {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Request',
      message: 'Are you sure you want to delete this request?',
      onConfirm: async () => {
        setConfirmDialogLoading(true)
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
        } finally {
          setConfirmDialogLoading(false)
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
        setConfirmDialogLoading(true)
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
        } finally {
          setConfirmDialogLoading(false)
        }
      }
    })
  }

  async function handleAddResilio() {
    if (!formData.userId || !formData.resilioLink || formData.resilioLink.trim() === '') {
      toast.error('Please fill in all fields.')
      return
    }

    setIsAddingResilio(true)
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
    } finally {
      setIsAddingResilio(false)
    }
  }

  async function handleRemoveResilio(uid) {
    setConfirmDialog({
      isOpen: true,
      title: 'Remove Resilio Sync Link',
      message: 'Are you sure you want to remove this Resilio Sync link?',
      onConfirm: async () => {
        setConfirmDialogLoading(true)
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
        } finally {
          setConfirmDialogLoading(false)
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

    const subnetPrefix = '10.11.10.'
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

  function getUserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }

  function normalizeBooking(b) {
    const tz = getUserTimezone()
    if (b.startAt && b.endAt) {
      const start = DateTime.fromISO(b.startAt, { zone: 'utc' }).setZone(tz)
      const end = DateTime.fromISO(b.endAt, { zone: 'utc' }).setZone(tz)
      return {
        ...b,
        date: start.toISODate(),
        startTime: start.toFormat('HH:mm'),
        endTime: end.toFormat('HH:mm'),
        timezone: b.timezone || tz,
        displayLabel: b.timezone ? `${start.toFormat('HH:mm')} – ${end.toFormat('HH:mm')} (${start.offsetNameShort})` : null
      }
    }
    return { ...b, timezone: b.timezone || tz, displayLabel: null }
  }

  async function loadBookings() {
    if (!userData?.uid) return
    try {
      const bookingsRef = collection(db, 'server_bookings')
      const q = query(bookingsRef, orderBy('date', 'asc'))
      const snapshot = await getDocs(q)
      let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      list = list.map(normalizeBooking)
      list.sort((a, b) => {
        if (a.startAt && b.startAt) return a.startAt.localeCompare(b.startAt)
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.startTime || '').localeCompare(b.startTime || '')
      })
      setBookings(list)
    } catch (error) {
      console.error('Error loading bookings:', error)
      setBookings([])
    }
  }

  async function fetchAllBookingsForOverlapCheck() {
    const bookingsRef = collection(db, 'server_bookings')
    const q = query(bookingsRef, orderBy('date', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  function getBookingRange(b) {
    if (b.startAt && b.endAt) {
      return { start: new Date(b.startAt).getTime(), end: new Date(b.endAt).getTime() }
    }
    const tz = b.timezone || 'UTC'
    const start = DateTime.fromISO(`${b.date}T${b.startTime || '00:00'}`, { zone: tz }).toMillis()
    const end = DateTime.fromISO(`${b.date}T${b.endTime || '23:59'}`, { zone: tz }).toMillis()
    return { start, end }
  }

  function hasOverlap(newStart, newEnd, existing) {
    const { start: exStart, end: exEnd } = getBookingRange(existing)
    return newStart < exEnd && newEnd > exStart
  }

  function timeToMinutes(timeStr) {
    const [h, m] = (timeStr || '00:00').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  function minutesToTime(mins) {
    const h = Math.floor(mins / 60) % 24
    const m = mins % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function getMinStartTime() {
    if (!bookingForm.date) return undefined
    const today = DateTime.local().toISODate()
    if (bookingForm.date !== today) return undefined
    const now = DateTime.local()
    const mins = now.hour * 60 + now.minute
    const roundedUp = Math.ceil(mins / 30) * 30
    return minutesToTime(roundedUp)
  }

  function getMinEndTime() {
    if (!bookingForm.date) return undefined
    const today = DateTime.local().toISODate()
    if (bookingForm.date !== today) return undefined
    const minStart = getMinStartTime()
    if (!minStart) return undefined
    const startMins = timeToMinutes(bookingForm.startTime)
    const minStartMins = timeToMinutes(minStart)
    const effectiveStart = Math.max(startMins, minStartMins)
    return minutesToTime(effectiveStart + 30)
  }

  function getMaxEndTime() {
    const startMins = timeToMinutes(bookingForm.startTime)
    return minutesToTime(startMins + 5 * 60)
  }

  async function createBooking(e) {
    e.preventDefault()
    if (!userData?.uid || !bookingForm.date || !bookingForm.startTime || !bookingForm.endTime) return
    const startMins = timeToMinutes(bookingForm.startTime)
    const endMins = timeToMinutes(bookingForm.endTime)
    if (endMins < startMins + 30) {
      toast.error('End time must be at least 30 minutes after start time.')
      return
    }
    if (endMins - startMins > 5 * 60) {
      toast.error('Booking duration cannot exceed 5 hours.')
      return
    }
    const tz = getUserTimezone()
    const startLocal = DateTime.fromISO(`${bookingForm.date}T${bookingForm.startTime}`, { zone: tz })
    const endLocal = DateTime.fromISO(`${bookingForm.date}T${bookingForm.endTime}`, { zone: tz })
    const today = DateTime.local().toISODate()
    if (bookingForm.date === today && startLocal.startOf('minute') < DateTime.local().startOf('minute')) {
      toast.error('Start time cannot be in the past.')
      return
    }
    const startAt = startLocal.toUTC().toISO()
    const endAt = endLocal.toUTC().toISO()
    const newStartMs = startLocal.toMillis()
    const newEndMs = endLocal.toMillis()

    const existing = await fetchAllBookingsForOverlapCheck()
    const overlapping = existing.find(b => hasOverlap(newStartMs, newEndMs, b))
    if (overlapping) {
      toast.error(`This time overlaps with an existing booking by ${overlapping.userName || 'another user'}.`)
      return
    }

    setIsSubmittingBooking(true)
    try {
      const bookingsRef = collection(db, 'server_bookings')
      const docRef = await addDoc(bookingsRef, {
        userId: userData.uid,
        userName: userData.name || 'Unknown',
        userIp: userData.ip || '',
        date: bookingForm.date,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        timezone: tz,
        startAt,
        endAt,
        purpose: bookingForm.purpose || '',
        createdAt: serverTimestamp()
      })
      const newBooking = normalizeBooking({
        id: docRef.id,
        userId: userData.uid,
        userName: userData.name || 'Unknown',
        date: bookingForm.date,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        timezone: tz,
        startAt,
        endAt,
        purpose: bookingForm.purpose || ''
      })
      setBookings(prev => {
        const next = [...prev, newBooking]
        next.sort((a, b) => {
          if (a.startAt && b.startAt) return a.startAt.localeCompare(b.startAt)
          if (a.date !== b.date) return a.date.localeCompare(b.date)
          return (a.startTime || '').localeCompare(b.startTime || '')
        })
        return next
      })
      setBookingForm({ date: '', startTime: '09:00', endTime: '12:00', purpose: '' })
      setShowBookingModal(false)
      toast.success('Booking created successfully')
    } catch (error) {
      console.error('Error creating booking:', error)
      toast.error('Failed to create booking. Please try again.')
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  async function cancelBooking(bookingId) {
    if (!bookingId) return
    try {
      await deleteDoc(doc(db, 'server_bookings', bookingId))
      await loadBookings()
      toast.success('Booking cancelled')
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Failed to cancel booking.')
    }
  }

  async function openApproveModal(user) {
    setOpeningApproveModalId(user.id)
    try {
      const { newUserIP, newUserCode } = await getNewUserCodes()
      setSelectedUser(user)
      setFormData({ ...formData, ip: newUserIP, serverCode: newUserCode, ssh_folder: '' })
      setShowApproveModal(true)
    } finally {
      setOpeningApproveModalId(null)
    }
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

    setIsUpdatingAccess(true)
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
    } finally {
      setIsUpdatingAccess(false)
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
              <div className="card-title">Loading server status</div>
            </div>
            <div className="card-content">
              <p className="terminal-text">Initializing server connection…</p>
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
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Infrastructure</span>
              <h2>Alpha server status</h2>
              <p>Live system health for the primary compute environment.</p>
            </div>
            <div className={`server-status-badge ${isServerOnline ? 'online' : 'offline'}`}>
              <div className="status-dot"></div>
              {isServerOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <div className="server-card">
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
                        <Cpu size={24} className="stat-icon-server" />
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
          </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Activity</span>
              <h2>Active connections</h2>
              <p>Current user sessions connected to the environment.</p>
            </div>
          </div>
          <div className="server-card">
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
          </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Access</span>
              <h2>Server access</h2>
              <p>Review your access state and credentials for the server environment.</p>
            </div>
            {!userData.serverCode && (
              <button className="server-btn-small" onClick={() => setShowAccessModal(true)}>
                Request Access
              </button>
            )}
          </div>
          <div className="server-card">
            <div className="card-content">
                {userData.serverCode ? (
                  <div className="access-credentials">
                    <p className="terminal-line-text">Access granted. Your credentials:</p>
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
          </section>

        {(userData.serverCode || userData.type === 'admin') && (
        <>
        <section className="dashboard-section">
          <div className="dashboard-section-heading">
            <div className="dashboard-section-heading-copy">
              <span className="dashboard-section-eyebrow">Reservation</span>
              <h2>Book server time</h2>
              <p>Reserve a time slot to use the server. All bookings are listed below. Overlapping times are not allowed.</p>
            </div>
            <button className="server-btn-small booking-open-btn" onClick={() => setShowBookingModal(true)}>
              <Plus size={16} />
              Book
            </button>
          </div>
          <div className="server-card">
            <div className="card-content">
              <div className="booking-calendar">
                {(() => {
                  const today = DateTime.local()
                  const days = Array.from({ length: 7 }, (_, i) => today.plus({ days: i }))
                  const dayStart = 0
                  const dayEnd = 24
                  const totalMins = (dayEnd - dayStart) * 60

                  function timeToMins(t) {
                    const [h, m] = (t || '00:00').split(':').map(Number)
                    return (h || 0) * 60 + (m || 0)
                  }

                  function getSlotStyle(b) {
                    const startMins = timeToMins(b.startTime)
                    const endMins = timeToMins(b.endTime)
                    const dayStartMins = dayStart * 60
                    const top = Math.max(0, startMins - dayStartMins)
                    const bottom = Math.min(totalMins, endMins - dayStartMins)
                    const height = Math.max(0, bottom - top)
                    return {
                      top: `${(top / totalMins) * 100}%`,
                      height: `${(height / totalMins) * 100}%`
                    }
                  }

                  const bookingsByDate = {}
                  days.forEach(d => { bookingsByDate[d.toISODate()] = [] })
                  bookings
                    .filter(b => days.some(d => d.toISODate() === b.date))
                    .forEach(b => {
                      if (bookingsByDate[b.date]) bookingsByDate[b.date].push(b)
                    })

                  const hours = Array.from({ length: dayEnd - dayStart }, (_, i) => dayStart + i)

                  return (
                    <>
                      <div className="booking-calendar-header">
                        <div className="booking-calendar-time-header" />
                        {days.map(day => (
                          <div key={day.toISODate()} className="booking-calendar-day-header">
                            <span className="booking-calendar-day-date">{day.toFormat('MMM d')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="booking-calendar-body">
                        <div className="booking-calendar-time-col">
                          {hours.map(h => (
                            <div key={h} className="booking-calendar-time-slot">
                              {h === 0 ? '12 am' : h === 12 ? '12 pm' : h > 12 ? `${h - 12} pm` : `${h} am`}
                            </div>
                          ))}
                        </div>
                        {days.map(day => (
                          <div key={day.toISODate()} className="booking-calendar-day-col">
                            <div className="booking-calendar-day-grid">
                              {hours.map(h => (
                                <div key={h} className="booking-calendar-hour-row" />
                              ))}
                              {(bookingsByDate[day.toISODate()] || []).map((b) => (
                                <div
                                  key={b.id}
                                  className="booking-calendar-slot"
                                  style={getSlotStyle(b)}
                                >
                                  {b.userId === userData?.uid && (
                                    <div className="booking-calendar-slot-actions">
                                      <button
                                        type="button"
                                        className="icon-btn booking-calendar-cancel"
                                        onClick={() => cancelBooking(b.id)}
                                        title="Cancel booking"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  )}
                                  <span className="booking-calendar-slot-time" title={b.timezone}>
                                    {b.startTime} – {b.endTime}
                                  </span>
                                  <span className="booking-calendar-slot-user">{b.userName || 'Unknown'}</span>
                                  {b.purpose && <span className="booking-calendar-slot-purpose">{b.purpose}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </section>

        <Modal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)}>
          <form onSubmit={createBooking}>
            <ModalHeader onClose={() => setShowBookingModal(false)}>
              <h3>Book server time</h3>
            </ModalHeader>
            <ModalBody>
              <div className="booking-form booking-form-modal">
                <div className="booking-form-row">
                  <div className="filter-group filter-group-full">
                    <label htmlFor="booking-date">Date</label>
                    <input
                      id="booking-date"
                      type="date"
                      value={bookingForm.date}
                      onChange={(e) => {
                        const newDate = e.target.value
                        const today = DateTime.local().toISODate()
                        let updates = { date: newDate }
                        if (newDate === today) {
                          const mins = DateTime.local().hour * 60 + DateTime.local().minute
                          const minStart = minutesToTime(Math.ceil(mins / 30) * 30)
                          const startMins = timeToMinutes(bookingForm.startTime)
                          const minStartMins = timeToMinutes(minStart)
                          if (startMins < minStartMins) {
                            updates.startTime = minStart
                            updates.endTime = minutesToTime(minStartMins + 30)
                          }
                        }
                        setBookingForm({ ...bookingForm, ...updates })
                      }}
                      className="form-control"
                      min={DateTime.local().toISODate()}
                      max={DateTime.local().plus({ days: 7 }).toISODate()}
                      required
                    />
                  </div>
                  <div className="booking-form-time-row">
                    <div className="filter-group">
                      <label htmlFor="booking-start">Start</label>
                      <input
                        id="booking-start"
                        type="time"
                        value={bookingForm.startTime}
                        min={getMinStartTime()}
                        onChange={(e) => {
                          const start = e.target.value
                          setBookingForm(prev => {
                            const endMins = timeToMinutes(prev.endTime)
                            const startMins = timeToMinutes(start)
                            let end = prev.endTime
                            if (endMins <= startMins + 30) end = minutesToTime(startMins + 30)
                            else if (endMins - startMins > 5 * 60) end = minutesToTime(startMins + 5 * 60)
                            return { ...prev, startTime: start, endTime: end }
                          })
                        }}
                        className="form-control"
                        required
                      />
                    </div>
                    <div className="filter-group">
                      <label htmlFor="booking-end">End</label>
                      <input
                        id="booking-end"
                        type="time"
                        value={bookingForm.endTime}
                        min={getMinEndTime()}
                        max={getMaxEndTime()}
                        onChange={(e) => {
                          const end = e.target.value
                          const startMins = timeToMinutes(bookingForm.startTime)
                          const endMins = timeToMinutes(end)
                          const cappedEnd = endMins - startMins > 5 * 60 ? minutesToTime(startMins + 5 * 60) : end
                          setBookingForm({ ...bookingForm, endTime: cappedEnd })
                        }}
                        className="form-control"
                        required
                      />
                    </div>
                  </div>
                  <div className="filter-group filter-group-full">
                    <label htmlFor="booking-purpose">Purpose (optional)</label>
                    <input
                      id="booking-purpose"
                      type="text"
                      placeholder="e.g. Simulation run"
                      value={bookingForm.purpose}
                      onChange={(e) => setBookingForm({ ...bookingForm, purpose: e.target.value })}
                      className="form-control"
                    />
                  </div>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <button type="button" className="modal-btn secondary" onClick={() => setShowBookingModal(false)}>
                Cancel
              </button>
              <button type="submit" className="modal-btn primary" disabled={isSubmittingBooking}>
                {isSubmittingBooking ? 'Booking…' : 'Book'}
              </button>
            </ModalFooter>
          </form>
        </Modal>
        </>
        )}

        {(userData.type === 'admin' || userData.resilio) && (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div className="dashboard-section-heading-copy">
                <span className="dashboard-section-eyebrow">Sync</span>
                <h2>Resilio Sync</h2>
                <p>Share and sync server files with personal devices when enabled for your account.</p>
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
            <div className="server-card">
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
            </section>
        )}

        {userData.type === 'admin' && (
          <section className="dashboard-section">
            <div className="dashboard-section-heading">
              <div className="dashboard-section-heading-copy">
                <span className="dashboard-section-eyebrow">Administration</span>
                <h2>Connection requests</h2>
                <p>Review pending access requests and manage existing server access assignments.</p>
              </div>
            </div>
            <div className="server-card">
              <div className="card-content">
                  <div className="requests-grid">
                    {serverRequests.map(user => (
                      <div key={user.id} className={`request-card ${user.status === 'pending' ? 'pending' : ''}`}>
                        <div className="request-header">
                          <div className="request-avatar-container">
                            {user.photoURL ? (
                              <img 
                                src={user.photoURL} 
                                alt={user.name}
                                className="request-avatar"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const fallback = e.target.parentElement.querySelector('.request-avatar-fallback');
                                  if (fallback) fallback.style.display = 'block';
                                }}
                              />
                            ) : null}
                            <Users 
                              size={20} 
                              className="request-avatar-fallback"
                              style={{ display: user.photoURL ? 'none' : 'block' }}
                            />
                          </div>
                          <div>
                            <div className="request-name">{user.name}</div>
                            <div className="request-id">ZeroTier: {user.zerotierId}</div>
                          </div>
                        </div>
                        <div className="request-actions">
                          {user.status === 'pending' ? (
                            <>
                              <button className="server-btn-action success" onClick={() => openApproveModal(user)} disabled={openingApproveModalId === user.id}>
                                {openingApproveModalId === user.id ? (
                                  <>
                                    <Loader2 size={16} className="btn-spinner" />
                                    Opening...
                                  </>
                                ) : (
                                  <>
                                    <Check size={16} />
                                    Approve
                                  </>
                                )}
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
            </section>
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
              onChange={(e) => {
                const value = e.target.value.slice(0, 10)
                if (value.length >= 10 && ZEROTIER_NETWORK_ID && value === ZEROTIER_NETWORK_ID.slice(0, 10)) {
                  toast.error('That\'s the network ID, not your address. Please enter your ZeroTier member address.')
                }
                setFormData({ ...formData, zerotierId: value })
              }}
              maxLength={10}
              required
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <button className="modal-btn secondary" onClick={() => setShowAccessModal(false)} disabled={isRequestingAccess}>Cancel</button>
          <button className="modal-btn primary" onClick={handleRequestAccess} disabled={isRequestingAccess}>
            {isRequestingAccess ? (
              <>
                <Loader2 size={18} className="btn-spinner" />
                Requesting...
              </>
            ) : (
              'Request Access'
            )}
          </button>
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
          <button className="modal-btn secondary" onClick={() => setShowResilioModal(false)} disabled={isAddingResilio}>Cancel</button>
          <button className="modal-btn primary" onClick={handleAddResilio} disabled={isAddingResilio}>
            {isAddingResilio ? (
              <>
                <Loader2 size={18} className="btn-spinner" />
                Adding...
              </>
            ) : (
              'Add Link'
            )}
          </button>
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
          <button className="modal-btn secondary" onClick={() => setShowApproveModal(false)} disabled={isApproving}>Cancel</button>
          <button className="modal-btn primary" onClick={handleApproveRequest} disabled={isApproving}>
            {isApproving ? (
              <>
                <Loader2 size={18} className="btn-spinner" />
                Approving...
              </>
            ) : (
              'Approve'
            )}
          </button>
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
          <button className="modal-btn secondary" onClick={() => setShowEditModal(false)} disabled={isUpdatingAccess}>Cancel</button>
          <button className="modal-btn primary" onClick={handleUpdateAccess} disabled={isUpdatingAccess}>
            {isUpdatingAccess ? (
              <>
                <Loader2 size={18} className="btn-spinner" />
                Updating...
              </>
            ) : (
              'Update'
            )}
          </button>
        </ModalFooter>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
        onConfirm={confirmDialog.onConfirm || (() => {})}
        title={confirmDialog.title}
        message={confirmDialog.message}
        loading={confirmDialogLoading}
      />
      <Footer />
    </div>
  )
}

export default Dashboard

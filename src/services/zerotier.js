import { ZEROTIER_AUTHENTICATE_URL, ZEROTIER_DEAUTHENTICATE_URL } from '../config/api'

export async function authenticateZeroTierMember(memberId, ip, name) {
  try {
    const response = await fetch(ZEROTIER_AUTHENTICATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ member_id: memberId, ip: ip, name: name })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error authenticating member: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    console.log(`Member ${memberId} authenticated successfully:`, data)
    return data
  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  }
}

export async function deauthenticateZeroTierMember(memberId) {
  try {
    const response = await fetch(ZEROTIER_DEAUTHENTICATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ member_id: memberId })
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error de-authenticating member: ${errorData.error || response.statusText}`)
    }

    const data = await response.json()
    console.log(`Member ${memberId} de-authenticated successfully:`, data)
    return data
  } catch (error) {
    console.error('De-authentication failed:', error)
    throw error
  }
}


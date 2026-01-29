export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
export const SSO_URL = import.meta.env.VITE_SSO_URL
export const ZEROTIER_AUTHENTICATE_URL = import.meta.env.VITE_ZEROTIER_AUTHENTICATE_URL
export const ZEROTIER_DEAUTHENTICATE_URL = import.meta.env.VITE_ZEROTIER_DEAUTHENTICATE_URL
export const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL
export const PORTAL_GUIDE_URL = import.meta.env.VITE_PORTAL_GUIDE_URL || 'https://portal.itcpr.org/guide?id=LMZN67tXj7MzmAqjFbiP'
export const ZEROTIER_NETWORK_ID = import.meta.env.VITE_ZEROTIER_NETWORK_ID || ''

if (!API_BASE_URL || !SSO_URL || !ZEROTIER_AUTHENTICATE_URL || !ZEROTIER_DEAUTHENTICATE_URL || !EMAIL_API_URL) {
  throw new Error('Missing required environment variables: VITE_API_BASE_URL, VITE_SSO_URL, VITE_ZEROTIER_AUTHENTICATE_URL, VITE_ZEROTIER_DEAUTHENTICATE_URL, VITE_EMAIL_API_URL')
}


import { firebaseConfig } from './config.js';
import { getAuth, signOut, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

let ssoData = null;

// Check for SSO data on page load
function checkForSSOData() {
    const urlParams = new URLSearchParams(window.location.search);
    const ssoParam = urlParams.get('sso');
    
    if (ssoParam) {
        try {
            ssoData = JSON.parse(decodeURIComponent(ssoParam));
            console.log('SSO data received:', ssoData);
            
            // Clear the URL parameter
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
            
            // Handle SSO authentication
            handleSSOAuthentication();
        } catch (error) {
            console.error('Error parsing SSO data:', error);
        }
    }
}

// Handle SSO authentication
async function handleSSOAuthentication() {
    if (!ssoData || !ssoData.token) {
        console.error('Invalid SSO data');
        return;
    }

    try {
        console.log('Authenticating with SSO token...');
        
        // Sign in with custom token
        await signInWithCustomToken(auth, ssoData.token);
        
        console.log('SSO authentication successful');
        
        // Store SSO data for later use
        localStorage.setItem('ssoData', JSON.stringify(ssoData));
        
        // Redirect to dashboard instead of reloading
        window.location.href = '/dashboard';
        
    } catch (error) {
        console.error('SSO authentication failed:', error);
    }
}

// Listen for postMessage from SSO popup
window.addEventListener('message', function(event) {
    // Verify the origin for security
    if (event.origin !== 'https://sso.itcpr.org') {
        return;
    }
    
    const data = event.data;
    
    if (data && data.token && data.tokenType === 'custom_token') {
        console.log('SSO data received via postMessage:', data);
        ssoData = data;
        handleSSOAuthentication();
    } else if (data && data.success === false) {
        console.error('SSO error received:', data.error);
    }
});

// SSO login function
window.signInWithGoogle = async function() {
    try {
        // Open SSO login in popup
        const ssoUrl = 'https://sso.itcpr.org?popup=true&parent=' + encodeURIComponent(window.location.origin);
        const popup = window.open(ssoUrl, 'SSO Login', 'width=500,height=600,scrollbars=yes,resizable=yes');
        
        // Wait for SSO authentication result
        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('SSO authentication timeout'));
            }, 60000); // 60 second timeout
            
            window.addEventListener('message', function handler(event) {
                // Verify the origin for security
                if (event.origin !== 'https://sso.itcpr.org') {
                    return;
                }
                
                const data = event.data;
                
                if (data && data.token && data.tokenType === 'custom_token') {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    resolve(data);
                } else if (data && data.success === false) {
                    clearTimeout(timeout);
                    window.removeEventListener('message', handler);
                    reject(new Error(data.error || 'SSO authentication failed'));
                }
            });
        });
        
        // Close popup if still open
        if (popup && !popup.closed) {
            popup.close();
        }
        
        // Handle successful SSO authentication
        ssoData = result;
        await handleSSOAuthentication();
        
    } catch (error) {
        console.error('SSO authentication error:', error);
    }
}

export async function signOutUser() {
    try {
        await signOut(auth);
        
        // Clear SSO data
        localStorage.removeItem('ssoData');
        ssoData = null;
        
        // Reload to update UI
        window.location.reload();
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

async function checkUserExists(email) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null;
    } catch (error) {
        console.error('Error checking email:', error);
        return null;
    }
}

export async function checkAuthState() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            try {
                if (user) {
                    const userExists = await checkUserExists(user.email);
                    if (userExists) {
                        resolve(userExists);
                    } else {
                        signOutUser();
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            } catch (error) {
                console.error(error);
                reject(error);
            }
        });
    });
}

// Initialize SSO check on page load
document.addEventListener('DOMContentLoaded', function() {
    checkForSSOData();
});

export { db, rtdb, auth };
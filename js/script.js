import { checkAuthState } from "./auth.js";

document.getElementById('year').textContent = new Date().getFullYear();

async function signInWithGoogle() {
    try {
        // Use the SSO system instead of direct Google authentication
        await window.signInWithGoogle();
    } catch (error) {
        console.error('Error signing in with SSO:', error);
    }
}

window.goToPage = function(page) {
    window.location.href = `/${page}`;
}

addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('loginBtn');
    
    // Check initial auth state
    const initialUser = await checkAuthState();
    if (initialUser) {
        // User is already logged in, redirect to dashboard
        window.location.href = '/dashboard';
        return;
    }
    
    loginBtn.addEventListener('click', async () => {
        try {
            await signInWithGoogle();
            // The SSO system will handle the redirect after successful authentication
        } catch (error) {
            console.error('Login failed:', error);
        }
    });
});
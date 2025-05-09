import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { checkAuthState } from "./auth.js";

document.getElementById('year').textContent = new Date().getFullYear();

async function signInWithGoogle() {
    try {
        await signInWithPopup(getAuth(), new GoogleAuthProvider());
    } catch (error) {
        console.error('Error signing in with Google:', error);
    }
}

addEventListener('DOMContentLoaded', async () => {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.addEventListener('click', async () => {
        const user = await checkAuthState();
        if (user) {
            window.location.href = '/dashboard';
        } else {
            await signInWithGoogle();
            loginBtn.click();
        }
    });
});
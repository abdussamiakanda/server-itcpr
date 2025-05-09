import { firebaseConfig } from './config.js';
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function signOutUser() {
    try {
        await signOut(getAuth());
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
        const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
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

export { db };
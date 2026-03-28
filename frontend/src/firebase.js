// Firebase SDK initialization
// Docs: https://firebase.google.com/docs/web/setup
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBD64ElFqIIh-Cbz2j8ccKXj5R4dOA_egs",
    authDomain: "ui-code-gen.firebaseapp.com",
    projectId: "ui-code-gen",
    storageBucket: "ui-code-gen.firebasestorage.app",
    messagingSenderId: "508579672764",
    appId: "1:508579672764:web:f4eaf928bb647e233c96b9",
    measurementId: "G-DCRVWN36Q6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export auth instance for use in signup/login pages
export const auth = getAuth(app);
export default app;
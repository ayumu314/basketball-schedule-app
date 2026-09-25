import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


const firebaseConfig = {
    apiKey: "AIzaSyC8W8wguYGOQYOzOOBZrU_mMbMMb0BwbxU",
    authDomain: "basketball-schedule-499bb.firebaseapp.com",
    projectId: "basketball-schedule-499bb",
    storageBucket: "basketball-schedule-499bb.firebasestorage.app",
    messagingSenderId: "1014657770842",
    appId: "1:1014657770842:web:ad0b02baa33cb76b213f63",
    measurementId: "G-F38VBEDBCG"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);


export { auth, provider, db };
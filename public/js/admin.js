import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { 
  getStorage,
  ref, 
  uploadBytesResumable,
  getDownloadURL 
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyCPzVfg58M_36pcmXtLFvn0OCgzMiMfZeE",
  authDomain: "therapy-font.firebaseapp.com",
  projectId: "therapy-font",
  storageBucket: "therapy-font.firebasestorage.app",
  messagingSenderId: "620550496974",
  appId: "1:620550496974:web:3ad9033e4fc0c7bf8e669f",
  measurementId: "G-0S5ECBGT7Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// DOM Elements
const loginForm = document.getElementById('login-form');
const adminInterface = document.getElementById('admin-interface');
const publishBtn = document.getElementById('publish-btn');
const mediaUpload = document.getElementById('media-upload');
const mediaPreview = document.getElementById('media-preview');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const authStatus = document.getElementById('auth-status');

// State
let currentFiles = [];

// Auth State
onAuthStateChanged(auth, (user) => {
  const isLoggedIn = !!user;
  loginForm.style.display = isLoggedIn ? 'none' : 'block';
  adminInterface.style.display = isLoggedIn ? 'block' : 'none';
  
  if (isLoggedIn) {
    authStatus.innerHTML = `
      <p>Logged in as ${user.email}</p>
      <button id="logout-btn" class="admin-btn">Logout</button>
    `;
    document.getElementById('logout-btn').addEventListener('click', () => {
      signOut(auth);
    });
  }
});

// Login Handler
loginForm.addEventListener('submit',
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
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    showLoading('Logging in...');
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(`Login failed: ${error.message}`);
  } finally {
    hideLoading();
  }
});

// Media Upload Preview
mediaUpload.addEventListener('change', (e) => {
  currentFiles = Array.from(e.target.files);
  renderMediaPreviews();
});

// Publish Handler
publishBtn.addEventListener('click', async () => {
  const title = document.getElementById('post-title').value;
  const content = document.getElementById('post-content').value;
  
  if (!title || !content) {
    alert('Title and content are required');
    return;
  }

  if (currentFiles.length === 0) {
    alert('Please upload at least one media file');
    return;
  }

  try {
    showLoading('Uploading media...');
    const mediaItems = await Promise.all(
      currentFiles.map((file, index) => uploadFile(file, index))
    );

    showLoading('Publishing post...');
    await addDoc(collection(db, "posts"), {
      title,
      content,
      media: mediaItems,
      createdAt: serverTimestamp(),
      author: auth.currentUser.uid
    });

    alert('Post published successfully!');
    resetForm();
  } catch (error) {
    console.error('Publish error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    hideLoading();
  }
});

// File Upload
async function uploadFile(file, index) {
  try {
    // Create storage reference
    const fileExt = file.name.split('.').pop();
    const storageRef = ref(storage, `media/${Date.now()}_${file.name.replace(/\s+/g, '_')}`);
    
    updateUploadStatus(index, 'Uploading...', 0);
    
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public, max-age=31536000',
    });
    
    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        updateUploadStatus(index, 'Uploading...', progress);
      },
      (error) => {
        console.error('Upload error:', error);
        updateUploadStatus(index, 'Upload failed', 0);
        throw error;
      }
    );
    
    await uploadTask;
    const url = await getDownloadURL(uploadTask.snapshot.ref);
    
    updateUploadStatus(index, 'Upload complete', 100);
    return {
      type: file.type.startsWith('video') ? 'video' : 'image',
      url,
      name: file.name,
      size: file.size
    };
  } catch (error) {
    console.error(`Failed to upload ${file.name}:`, error);
    throw error;
  }
}

// Helper Functions
function renderMediaPreviews() {
  mediaPreview.innerHTML = '';
  
  if (currentFiles.length === 0) {
    mediaPreview.innerHTML = '<p>No media selected</p>';
    return;
  }
  
  currentFiles.forEach((file, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'media-preview-item';
    
    // Preview
    const preview = file.type.startsWith('image')
      ? document.createElement('img')
      : document.createElement('video');
    preview.src = URL.createObjectURL(file);
    if (file.type.startsWith('video')) preview.controls = true;
    
    // File info
    const info = document.createElement('p');
    info.textContent = `${file.name} (${formatFileSize(file.size)})`;
    
    // Progress
    const progress = document.createElement('div');
    progress.className = 'upload-progress';
    progress.innerHTML = `
      <div class="progress-bar"></div>
      <div class="status">Waiting to upload</div>
    `;
    
    previewItem.append(preview, info, progress);
    mediaPreview.append(previewItem);
  });
}

function updateUploadStatus(index, message, percent) {
  const items = document.querySelectorAll('.media-preview-item');
  if (items[index]) {
    const progressBar = items[index].querySelector('.progress-bar');
    const status = items[index].querySelector('.status');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (status) status.textContent = message;
    
    if (percent === 100) {
      progressBar.style.backgroundColor = '#4CAF50';
    } else if (message.includes('fail')) {
      progressBar.style.backgroundColor = '#f44336';
    }
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function resetForm() {
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  mediaUpload.value = '';
  currentFiles = [];
  mediaPreview.innerHTML = '<p>No media selected</p>';
}

function showLoading(message) {
  loadingText.textContent = message;
  loadingOverlay.classList.add('active');
}

function hideLoading() {
  loadingOverlay.classList.remove('active');
}
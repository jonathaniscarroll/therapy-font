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
  onAuthStateChanged
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

// Initialize Firebase
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

// State
let currentFiles = [];

// Auth State
onAuthStateChanged(auth, (user) => {
  const isLoggedIn = !!user;
  loginForm.style.display = isLoggedIn ? 'none' : 'block';
  adminInterface.style.display = isLoggedIn ? 'block' : 'none';
});

// Login Handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert(`Login failed: ${error.message}`);
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

  try {
    const mediaItems = await Promise.all(
      currentFiles.map((file, index) => uploadFile(file, index))
    );

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
  }
});

// File Upload with Retry
async function uploadFile(file, index) {
  try {
    // Compress video before upload
    let fileToUpload = file;
    if (file.type.startsWith('video/')) {
      updateUploadStatus(index, 'Compressing video...', 0);
      fileToUpload = await compressVideo(file);
      updateUploadStatus(index, 'Uploading compressed video...', 0);
    }

    // Create storage reference
    const fileExt = fileToUpload.name.split('.').pop();
    const storageRef = ref(storage, `media/${Date.now()}_${fileToUpload.name.replace(/\s+/g, '_')}`);
    
    // Rest of your upload logic remains the same...
    updateUploadStatus(index, 'Uploading...', 0);
    
    const uploadTask = uploadBytesResumable(storageRef, fileToUpload, {
      contentType: fileToUpload.type,
      cacheControl: 'public, max-age=31536000', // 1 year cache
      contentDisposition: `inline; filename=${encodeURIComponent(fileToUpload.name)}`
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
      type: fileToUpload.type.startsWith('video') ? 'video' : 'image',
      url,
      name: fileToUpload.name,
      originalSize: file.size,
      compressedSize: fileToUpload.size,
      compressionRatio: file.size > 0 ? Math.round((1 - (fileToUpload.size / file.size)) * 100) : 0
    };
  } catch (error) {
    console.error(`Failed to upload ${file.name}:`, error);
    updateUploadStatus(index, 'Upload failed - retrying...', 0);
    
    // Retry once
    try {
      return await uploadFile(file, index);
    } catch (retryError) {
      throw new Error(`Failed to upload ${file.name} after retry`);
    }
  }
}

// Helper Functions
function renderMediaPreviews() {
  mediaPreview.innerHTML = '';
  
  currentFiles.forEach((file, index) => {
    const previewItem = document.createElement('div');
    previewItem.className = 'media-preview-item';
    
    // Preview
    const preview = file.type.startsWith('image')
      ? document.createElement('img')
      : document.createElement('video');
    preview.src = URL.createObjectURL(file);
    if (file.type.startsWith('video')) preview.controls = true;
    
    // Caption
    const caption = document.createElement('input');
    caption.type = 'text';
    caption.className = 'media-caption';
    caption.placeholder = 'Caption (optional)';
    
    // Progress
    const progress = document.createElement('div');
    progress.className = 'upload-progress';
    progress.innerHTML = `
      <div class="progress-bar"></div>
      <div class="status">Waiting to upload</div>
    `;
    
    previewItem.append(preview, caption, progress);
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
      progressBar.style.backgroundColor = '#4CAF50'; // Green when complete
    } else if (message.includes('fail')) {
      progressBar.style.backgroundColor = '#f44336'; // Red on failure
    }
  }
}

function resetForm() {
  document.getElementById('post-title').value = '';
  document.getElementById('post-content').value = '';
  mediaUpload.value = '';
  currentFiles = [];
  mediaPreview.innerHTML = '';
}

// Add this function to your admin.js
async function compressVideo(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('video/')) {
      resolve(file); // Skip non-video files
      return;
    }

    const video = document.createElement('video');
    const source = URL.createObjectURL(file);
    video.src = source;

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set target dimensions (adjust as needed)
      const targetWidth = 1280;
      const targetHeight = Math.round(video.videoHeight * (targetWidth / video.videoWidth));
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      video.oncanplay = () => {
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        
        // Convert to compressed format (MP4 with H.264)
        canvas.toBlob(async (blob) => {
          const compressedFile = new File([blob], file.name, {
            type: 'video/mp4',
            lastModified: Date.now()
          });
          
          URL.revokeObjectURL(source);
          resolve(compressedFile);
        }, 'video/mp4', 0.7); // 0.7 is quality (0-1)
      };
      
      video.play();
    };

    video.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error('Video processing failed'));
    };
  });
}
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  limit,
  startAfter,
  doc,
  updateDoc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';
import { 
  getAuth,
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Elements
const postsGrid = document.getElementById('posts-grid');
const fullscreenViewer = document.getElementById('fullscreen-viewer');
const fullscreenContent = document.querySelector('.fullscreen-content');
const closeFullscreen = document.querySelector('.close-fullscreen');
let lastVisible = null;
let loading = false;
let allPostsLoaded = false;
let currentUser = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  checkAuthState();
  loadInitialPosts();
  setupScrollListener();
});

// Auth state
function checkAuthState() {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
  });
}

// Load first set of posts
async function loadInitialPosts() {
  try {
    showLoading(true);
    
    const q = query(
      collection(db, "posts"), 
      orderBy("createdAt", "desc"), 
      limit(9)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      showNoPostsMessage();
      return;
    }

    querySnapshot.forEach(doc => {
      createGridPost(doc.id, doc.data());
    });
    
    lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];
  } catch (error) {
    console.error("Error loading posts:", error);
    showErrorMessage();
  } finally {
    showLoading(false);
  }
}

// Load more posts when scrolling
async function loadMorePosts() {
  if (loading || allPostsLoaded) return;
  
  loading = true;
  showLoading(true);
  
  try {
    const nextQ = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      startAfter(lastVisible),
      limit(6)
    );
    
    const nextSnapshot = await getDocs(nextQ);
    
    if (nextSnapshot.empty) {
      allPostsLoaded = true;
      return;
    }
    
    nextSnapshot.forEach(doc => {
      createGridPost(doc.id, doc.data());
    });
    
    lastVisible = nextSnapshot.docs[nextSnapshot.docs.length-1];
  } catch (error) {
    console.error("Error loading more posts:", error);
  } finally {
    loading = false;
    showLoading(false);
  }
}

// Create grid post element
function createGridPost(postId, post) {
  const gridItem = document.createElement('div');
  gridItem.className = 'grid-item';
  gridItem.dataset.postId = postId;
  
  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'media-container';
  
  if (post.media && post.media.length > 0) {
    const media = post.media[0];
    if (media.type === 'video') {
      // Create video thumbnail container
      const thumbnailContainer = document.createElement('div');
      thumbnailContainer.className = 'video-thumbnail-container';
      
      // Create thumbnail image (will be set via JS)
      const thumbnail = document.createElement('img');
      thumbnail.className = 'video-thumbnail';
      thumbnail.loading = 'lazy';
      
      // Create play icon overlay
      const playIcon = document.createElement('div');
      playIcon.className = 'video-play-icon';
      playIcon.innerHTML = '▶';
      
      // Load thumbnail from video
      loadVideoThumbnail(media.url, thumbnail);
      
      thumbnailContainer.appendChild(thumbnail);
      thumbnailContainer.appendChild(playIcon);
      mediaContainer.appendChild(thumbnailContainer);
    } else {
      // Regular image handling
      const img = createImageElement(media.url, false);
      mediaContainer.appendChild(img);
    }
  }
  
  const overlay = document.createElement('div');
  overlay.className = 'grid-overlay';
  
  if (post.title) {
    const title = document.createElement('h3');
    title.className = 'grid-title';
    title.textContent = post.title;
    overlay.appendChild(title);
  }
  
  if (post.content) {
    const content = document.createElement('p');
    content.className = 'grid-content';
    content.textContent = post.content;
    overlay.appendChild(content);
  }
  
  gridItem.appendChild(mediaContainer);
  gridItem.appendChild(overlay);
  
  gridItem.addEventListener('click', () => {
    openFullscreenView(postId, post);
  });
  
  postsGrid.appendChild(gridItem);
}

function loadVideoThumbnail(videoUrl, thumbnailElement) {
  // Create a video element to capture the thumbnail
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;
  
  // When enough data is loaded to show a frame
  video.addEventListener('loadeddata', () => {
    // Seek to a frame at 25% of the video
    video.currentTime = Math.min(0.25, video.duration * 0.25);
  });
  
  // When seeking is complete
  video.addEventListener('seeked', () => {
    // Create a canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Set the thumbnail source
    thumbnailElement.src = canvas.toDataURL('image/jpeg', 0.8);
    
    // Clean up
    video.remove();
  });
  
  // Start loading the video
  video.load();
}


// Open fullscreen view
function openFullscreenView(postId, post) {
  fullscreenContent.innerHTML = '';
  
  // Add media
  if (post.media && post.media.length > 0) {
    const media = post.media[0];
    const mediaElement = media.type === 'video' 
      ? createVideoElement(media.url, true)
      : createImageElement(media.url, true);
    fullscreenContent.appendChild(mediaElement);
  }
  
  // Add text
  const textContainer = document.createElement('div');
  textContainer.className = 'fullscreen-text';
  
  if (post.title) {
    const title = document.createElement('h1');
    title.className = 'fullscreen-title';
    title.textContent = post.title;
    textContainer.appendChild(title);
  }
  
  if (post.content) {
    const content = document.createElement('div');
    content.className = 'fullscreen-content';
    content.textContent = post.content;
    textContainer.appendChild(content);
  }
  
  fullscreenContent.appendChild(textContainer);
  
  // Add edit buttons if admin
  if (currentUser) {
    const editButtons = document.createElement('div');
    editButtons.className = 'edit-buttons';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editPost(postId));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'edit-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deletePost(postId));
    
    editButtons.appendChild(editBtn);
    editButtons.appendChild(deleteBtn);
    fullscreenContent.appendChild(editButtons);
  }
  
  fullscreenViewer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// Close fullscreen view
closeFullscreen.addEventListener('click', () => {
  fullscreenViewer.classList.remove('active');
  document.body.style.overflow = 'auto';
});

// Create media elements
function createImageElement(src, isFullscreen) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.loading = 'lazy';
  img.className = isFullscreen ? 'fullscreen-media' : 'grid-media';
  return img;
}

function createVideoElement(src, isFullscreen) {
  const video = document.createElement('video');
  video.src = src;
  video.controls = true;
  video.playsInline = true;
  video.className = isFullscreen ? 'fullscreen-media' : 'grid-media';
  if (!isFullscreen) {
    video.muted = true;
    video.loop = true;
  }
  return video;
}

// Post editing functions
function editPost(postId) {
  // Implement your edit functionality here
  alert(`Editing post ${postId}`);
}

async function deletePost(postId) {
  if (confirm('Are you sure you want to delete this post?')) {
    try {
      await deleteDoc(doc(db, "posts", postId));
      document.querySelector(`.grid-item[data-post-id="${postId}"]`).remove();
      fullscreenViewer.classList.remove('active');
    } catch (error) {
      console.error("Error deleting post:", error);
      alert('Failed to delete post');
    }
  }
}

// Scroll listener for infinite loading
function setupScrollListener() {
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry.isIntersecting && !loading && !allPostsLoaded) {
      loadMorePosts();
    }
  }, {
    rootMargin: '200px',
    threshold: 0.1
  });

  const sentinel = document.createElement('div');
  sentinel.id = 'load-more-sentinel';
  postsGrid.appendChild(sentinel);
  observer.observe(sentinel);
}

// Helper functions
function showLoading(show) {
  const loader = document.getElementById('loading-spinner') || createLoader();
  loader.style.display = show ? 'block' : 'none';
}

function createLoader() {
  const loader = document.createElement('div');
  loader.id = 'loading-spinner';
  loader.className = 'loading-spinner';
  document.body.appendChild(loader);
  return loader;
}

function showNoPostsMessage() {
  const message = document.createElement('div');
  message.className = 'no-posts';
  message.textContent = 'No posts available';
  postsGrid.appendChild(message);
}

function showErrorMessage() {
  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = 'Error loading posts';
  postsGrid.appendChild(error);
}
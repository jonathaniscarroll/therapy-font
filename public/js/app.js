
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy,
  limit,
  startAfter
} from 'https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCPzVfg58M_36pcmXtLFvn0OCgzMiMfZeE",
  authDomain: "therapy-font.firebaseapp.com",
  projectId: "therapy-font",
  storageBucket: "therapy-font.firebasestorage.app", // Fixed storage bucket
  messagingSenderId: "620550496974",
  appId: "1:620550496974:web:3ad9033e4fc0c7bf8e669f",
  measurementId: "G-0S5ECBGT7Y"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const contentWrapper = document.querySelector('.content-wrapper');
let lastVisible = null;
let loading = false;
let allPostsLoaded = false;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  loadInitialPosts();
  setupScrollListener();
});

// Load first set of posts
async function loadInitialPosts() {
  try {
    showLoading(true);
    const q = query(
      collection(db, "posts"), 
      orderBy("createdAt", "desc"), 
      limit(3)
    );
    const querySnapshot = await getDocs(q);
    
    console.log("Initial posts loaded:", querySnapshot.size); // Debug log
    
    if (querySnapshot.empty) {
      showNoPostsMessage();
      return;
    }

    lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];
    querySnapshot.forEach(doc => {
      createFullScreenPost(doc.data());
    });
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
      limit(2)
    );
    
    const nextSnapshot = await getDocs(nextQ);
    console.log("More posts loaded:", nextSnapshot.size); // Debug log
    
    if (nextSnapshot.empty) {
      console.log("No more posts to load");
      allPostsLoaded = true;
      return;
    }
    
    lastVisible = nextSnapshot.docs[nextSnapshot.docs.length-1];
    nextSnapshot.forEach(doc => {
      createFullScreenPost(doc.data());
    });
  } catch (error) {
    console.error("Error loading more posts:", error);
  } finally {
    loading = false;
    showLoading(false);
  }
}

// Create full-screen post element
function createFullScreenPost(post) {
  const postElement = document.createElement('div');
  postElement.className = 'full-screen-post';
  
  // Media container
  const mediaContainer = document.createElement('div');
  mediaContainer.className = 'media-container';
  
  if (post.media && post.media.length > 0) {
    const media = post.media[0];
    if (media.type === 'video') {
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';
      
      const video = document.createElement('video');
      video.src = media.url;
      video.controls = true;
      video.playsInline = true;
      video.loop = true;
      video.muted = true;
      
      // Add click to play/pause
      video.addEventListener('click', () => {
        if (video.paused) {
          video.play().catch(e => console.log("Play failed:", e));
        } else {
          video.pause();
        }
      });
      
      videoWrapper.appendChild(video);
      mediaContainer.appendChild(videoWrapper);
    } else {
      const img = document.createElement('img');
      img.src = media.url;
      img.alt = media.caption || '';
      mediaContainer.appendChild(img);
    }
  }
  
  // Text overlay
  const textOverlay = document.createElement('div');
  textOverlay.className = 'text-overlay';
  
  if (post.title) {
    const title = document.createElement('h1');
    title.className = 'post-title';
    title.textContent = post.title;
    textOverlay.appendChild(title);
  }
  
  if (post.content) {
    const content = document.createElement('div');
    content.className = 'post-content';
    content.textContent = post.content;
    textOverlay.appendChild(content);
  }
  
  postElement.appendChild(mediaContainer);
  postElement.appendChild(textOverlay);
  contentWrapper.appendChild(postElement);
}

// Scroll listener for infinite loading
function setupScrollListener() {
  window.addEventListener('scroll', () => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.body.offsetHeight;
    
    console.log(`Scroll position: ${scrollPosition}/${documentHeight}`); // Debug
    
    if (scrollPosition >= documentHeight - 100 && !loading && !allPostsLoaded) {
      loadMorePosts();
    }
  }, { passive: true });
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
  contentWrapper.appendChild(message);
}

function showErrorMessage() {
  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = 'Error loading posts';
  contentWrapper.appendChild(error);
}
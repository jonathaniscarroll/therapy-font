
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
// Add a simple cache mechanism
const postCache = new Map();

async function loadInitialPosts() {
  try {
    showLoading(true);
    
    // Check cache first
    if (postCache.has('initialPosts')) {
      const cachedPosts = postCache.get('initialPosts');
      cachedPosts.forEach(post => createFullScreenPost(post));
      showLoading(false);
      return;
    }
    
    const q = query(
      collection(db, "posts"), 
      orderBy("createdAt", "desc"), 
      limit(3)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      showNoPostsMessage();
      return;
    }

    const posts = [];
    querySnapshot.forEach(doc => {
      posts.push(doc.data());
      createFullScreenPost(doc.data());
    });
    
    // Cache the results
    postCache.set('initialPosts', posts);
    lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];
  } catch (error) {
    console.error("Error loading posts:", error);
    showErrorMessage();
  } finally {
    showLoading(false);
  }
}

// Load more posts when scrolling
// Add retry logic to loadMorePosts
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
      
      if (nextSnapshot.empty) {
        allPostsLoaded = true;
        return;
      }
      
      lastVisible = nextSnapshot.docs[nextSnapshot.docs.length-1];
      
      // Cache these posts
      const newPosts = [];
      nextSnapshot.forEach(doc => {
        newPosts.push(doc.data());
        createFullScreenPost(doc.data());
      });
      
      postCache.set(`posts-after-${lastVisible.id}`, newPosts);
    } catch (error) {
      console.error("Error loading more posts:", error);
      
      // Show retry button
      const retryBtn = document.createElement('button');
      retryBtn.className = 'retry-button';
      retryBtn.textContent = 'Retry Loading';
      retryBtn.addEventListener('click', () => {
        retryBtn.remove();
        loadMorePosts();
      });
      
      const sentinel = document.getElementById('load-more-sentinel');
      if (sentinel) sentinel.before(retryBtn);
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
    // In createFullScreenPost function, modify video handling:
if (media.type === 'video') {
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'video-wrapper';
    
    const video = document.createElement('video');
    video.src = media.url;
    video.controls = true;
    video.playsInline = true;
    video.loop = true;
    video.muted = true;
    video.preload = 'metadata'; // Optimize preloading
    video.loading = 'lazy'; // Lazy load videos
    
    // Add loading state
    video.addEventListener('loadstart', () => {
      videoWrapper.classList.add('video-loading');
    });
    
    video.addEventListener('loadedmetadata', () => {
      videoWrapper.classList.remove('video-loading');
    });
    
    // Add click to play/pause with better UX
    const playOverlay = document.createElement('div');
    playOverlay.className = 'video-overlay';
    const playButton = document.createElement('button');
    playButton.className = 'play-button';
    playButton.innerHTML = '▶';
    playOverlay.appendChild(playButton);
    
    playOverlay.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video.paused) {
        video.play().catch(e => console.log("Play failed:", e));
        playOverlay.style.display = 'none';
      }
    });
    
    video.addEventListener('pause', () => {
      playOverlay.style.display = 'flex';
    });
    
    videoWrapper.appendChild(video);
    videoWrapper.appendChild(playOverlay);
    mediaContainer.appendChild(videoWrapper);
  }
     else {
        const img = document.createElement('img');
        img.src = media.url;
        img.alt = media.caption || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        
        // Use a blurred placeholder for better perceived performance
        img.style.transition = 'filter 0.3s ease';
        img.style.filter = 'blur(5px)';
        
        img.onload = () => {
          img.style.filter = 'none';
        };
        
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
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !loading && !allPostsLoaded) {
          loadMorePosts();
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });
  
    // Create and observe a sentinel element
    const sentinel = document.createElement('div');
    sentinel.id = 'load-more-sentinel';
    contentWrapper.appendChild(sentinel);
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
  contentWrapper.appendChild(message);
}

function showErrorMessage() {
  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = 'Error loading posts';
  contentWrapper.appendChild(error);
}
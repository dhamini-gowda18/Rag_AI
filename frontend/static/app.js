// Frontend JavaScript Logic for FastAPI AI RAG SPA

const API_BASE = '/api';

// Application State
const state = {
  token: localStorage.getItem('token') || null,
  user: null,
  isChatLoading: false
};

// DOM Elements
const authOverlay = document.getElementById('authOverlay');
const appContainer = document.getElementById('appContainer');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignupBtn = document.getElementById('showSignup');
const showLoginBtn = document.getElementById('showLogin');
const authSubtitle = document.getElementById('authSubtitle');

const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const signupNameInput = document.getElementById('signupName');
const signupEmailInput = document.getElementById('signupEmail');
const signupPasswordInput = document.getElementById('signupPassword');

const userNameDisplay = document.getElementById('userName');
const userEmailDisplay = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadStatusContainer = document.getElementById('uploadStatusContainer');
const uploadFileName = document.getElementById('uploadFileName');
const uploadPercent = document.getElementById('uploadPercent');
const uploadProgressBar = document.getElementById('uploadProgressBar');
const uploadMessage = document.getElementById('uploadMessage');

const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// INITIALIZE APP
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkAuthSession();
});

// EVENT LISTENERS SETUP
function setupEventListeners() {
  // Auth Form Toggles
  showSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    authSubtitle.textContent = 'Create an account to upload documents';
  });

  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    authSubtitle.textContent = 'Login to start querying your documents';
  });

  // Form Submissions
  loginForm.addEventListener('submit', handleLogin);
  signupForm.addEventListener('submit', handleSignup);
  logoutBtn.addEventListener('click', handleLogout);
  chatForm.addEventListener('submit', handleChatSubmit);

  // Auto-resize chat textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = (chatInput.scrollHeight) + 'px';
  });

  // Drag and Drop files
  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });
}

// CHECK PERSISTED AUTH SESSION
async function checkAuthSession() {
  if (state.token) {
    const success = await fetchCurrentUser();
    if (success) {
      showAppScreen();
    } else {
      clearAuthSession();
    }
  } else {
    showAuthScreen();
  }
}

// NETWORK APIS
async function fetchCurrentUser() {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Session expired');
    }

    const userData = await response.json();
    state.user = userData;
    updateUserProfileUI();
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    return false;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = loginEmailInput.value;
  const password = loginPasswordInput.value;

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Login failed. Please check credentials.');
    }

    saveAuthSession(data.access_token);
    const success = await fetchCurrentUser();
    if (success) {
      showAppScreen();
      showToast('Logged In Successfully', `Welcome back, ${state.user.full_name || state.user.email}!`, 'success');
      // Clear forms
      loginEmailInput.value = '';
      loginPasswordInput.value = '';
    }
  } catch (err) {
    showToast('Login Failed', err.message, 'error');
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const full_name = signupNameInput.value;
  const email = signupEmailInput.value;
  const password = signupPasswordInput.value;

  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, full_name })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Registration failed');
    }

    saveAuthSession(data.access_token);
    const success = await fetchCurrentUser();
    if (success) {
      showAppScreen();
      showToast('Account Created', 'Successfully registered and logged in!', 'success');
      // Clear forms
      signupNameInput.value = '';
      signupEmailInput.value = '';
      signupPasswordInput.value = '';
    }
  } catch (err) {
    showToast('Sign Up Failed', err.message, 'error');
  }
}

function handleLogout() {
  clearAuthSession();
  showToast('Logged Out', 'You have been successfully logged out.', 'info');
}

// UPLOAD DOCUMENT HANDLER (XMLHttpRequest for progress monitoring)
function handleFileUpload(file) {
  // Validate file types
  const allowedExtensions = /(\.pdf|\.txt)$/i;
  if (!allowedExtensions.exec(file.name)) {
    showToast('Invalid File', 'Only PDF and TXT documents are allowed.', 'error');
    return;
  }

  // Show status container
  uploadStatusContainer.classList.remove('hidden');
  uploadFileName.textContent = file.name;
  uploadPercent.textContent = '0%';
  uploadProgressBar.style.width = '0%';
  uploadMessage.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Preparing file...`;

  const formData = new FormData();
  formData.append('file', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_BASE}/documents/upload`, true);
  xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);

  // Track upload progress
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percentComplete = Math.round((e.loaded / e.total) * 100);
      uploadPercent.textContent = `${percentComplete}%`;
      uploadProgressBar.style.width = `${percentComplete}%`;
      if (percentComplete === 100) {
        uploadMessage.innerHTML = `<i class="fa-solid fa-gear fa-spin"></i> Processing & embedding file contents...`;
      } else {
        uploadMessage.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
      }
    }
  };

  // Upload finished
  xhr.onload = () => {
    if (xhr.status === 201) {
      const response = JSON.parse(xhr.responseText);
      uploadProgressBar.style.backgroundColor = 'var(--color-success)';
      uploadMessage.innerHTML = `<span style="color: var(--color-success)"><i class="fa-regular fa-circle-check"></i> Document processed successfully!</span>`;
      showToast('Document Uploaded', response.message || 'File indexed successfully.', 'success');
      
      // Update chat feed instructions if empty
      const welcome = document.querySelector('.empty-chat-state');
      if (welcome) {
        welcome.querySelector('p').innerHTML = `Your document <strong>${response.filename}</strong> has been indexed! You can now start typing questions below.`;
      }
    } else {
      let errorMsg = 'Upload failed';
      try {
        const err = JSON.parse(xhr.responseText);
        errorMsg = err.detail || errorMsg;
      } catch(e) {}
      
      uploadProgressBar.style.width = '100%';
      uploadProgressBar.style.backgroundColor = 'var(--color-error)';
      uploadMessage.innerHTML = `<span style="color: var(--color-error)"><i class="fa-regular fa-circle-xmark"></i> ${errorMsg}</span>`;
      showToast('Upload Failed', errorMsg, 'error');
    }
  };

  xhr.onerror = () => {
    uploadMessage.innerHTML = `<span style="color: var(--color-error)"><i class="fa-regular fa-circle-xmark"></i> Connection error.</span>`;
    showToast('Network Error', 'Could not establish connection to the server.', 'error');
  };

  xhr.send(formData);
}

// CHAT SUBMISSION HANDLER
async function handleChatSubmit(e) {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question || state.isChatLoading) return;

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Append user question
  appendMessage(question, 'user');
  
  // Append loading typing bubble
  const loaderId = appendTypingIndicator();
  state.isChatLoading = true;

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ question })
    });

    const data = await response.json();
    
    // Remove loading typing bubble
    removeTypingIndicator(loaderId);
    state.isChatLoading = false;

    if (!response.ok) {
      throw new Error(data.detail || 'Chat request failed.');
    }

    // Append AI response
    appendMessage(data.answer, 'bot', data.sources || []);
  } catch (err) {
    removeTypingIndicator(loaderId);
    state.isChatLoading = false;
    appendMessage(`Sorry, I encountered an error while processing your request: "${err.message}". Make sure you have uploaded at least one document.`, 'bot');
    showToast('Query Error', err.message, 'error');
  }
}

// UI SCREEN TRANSITIONS AND SESSION STORAGE
function saveAuthSession(token) {
  state.token = token;
  localStorage.setItem('token', token);
}

function clearAuthSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  showAuthScreen();
  
  // Reset UI elements
  uploadStatusContainer.classList.add('hidden');
  chatMessages.innerHTML = `
    <div class="empty-chat-state">
      <div class="welcome-icon"><i class="fa-regular fa-comments"></i></div>
      <h3>AI Document Assistant</h3>
      <p>Please upload a PDF or TXT document on the sidebar first, then type a question. The AI will extract relevant text chunks from the document to generate context-rich answers.</p>
    </div>
  `;
}

function showAuthScreen() {
  authOverlay.classList.remove('hidden');
  appContainer.classList.add('hidden');
}

function showAppScreen() {
  authOverlay.classList.add('hidden');
  appContainer.classList.remove('hidden');
}

function updateUserProfileUI() {
  if (state.user) {
    userNameDisplay.textContent = state.user.full_name || 'Authenticated User';
    userEmailDisplay.textContent = state.user.email;
  }
}

// MESSAGE RENDERING HELPERS
function appendMessage(text, sender, sources = []) {
  // Remove empty welcome screen if it exists
  const emptyState = document.querySelector('.empty-chat-state');
  if (emptyState) {
    emptyState.remove();
  }

  const row = document.createElement('div');
  row.className = `message-row ${sender}-row`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  // Format text (convert markdown-style **bold** and newlines)
  const escapedText = escapeHTML(text);
  const formattedText = escapedText
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  
  bubble.innerHTML = `<p>${formattedText}</p>`;

  // Render sources accordion for bot replies if sources exist
  if (sender === 'bot' && sources && sources.length > 0) {
    const accordion = document.createElement('div');
    accordion.className = 'sources-accordion';

    const trigger = document.createElement('div');
    trigger.className = 'accordion-trigger';
    trigger.innerHTML = `<i class="fa-solid fa-chevron-right"></i> <span>Retrieved Context (${sources.length} sources)</span>`;

    const content = document.createElement('div');
    content.className = 'accordion-content';

    sources.forEach((source, index) => {
      if (source.trim()) {
        const item = document.createElement('div');
        item.className = 'source-item';
        item.innerHTML = `<strong>Source ${index + 1}:</strong> ${escapeHTML(source)}`;
        content.appendChild(item);
      }
    });

    // Expand/Collapse event listener
    trigger.addEventListener('click', () => {
      const isExpanded = trigger.classList.contains('expanded');
      if (isExpanded) {
        trigger.classList.remove('expanded');
        content.classList.remove('expanded');
      } else {
        trigger.classList.add('expanded');
        content.classList.add('expanded');
      }
      // Scroll workspace to make sure content is visible
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 100);
    });

    accordion.appendChild(trigger);
    accordion.appendChild(content);
    bubble.appendChild(accordion);
  }

  row.appendChild(bubble);
  chatMessages.appendChild(row);

  // Auto Scroll
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendTypingIndicator() {
  const emptyState = document.querySelector('.empty-chat-state');
  if (emptyState) emptyState.remove();

  const id = `loader-${Date.now()}`;
  const row = document.createElement('div');
  row.className = 'message-row bot-row';
  row.id = id;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const loader = document.createElement('div');
  loader.className = 'typing-loader';
  loader.innerHTML = '<span></span><span></span><span></span>';

  bubble.appendChild(loader);
  row.appendChild(bubble);
  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return id;
}

function removeTypingIndicator(id) {
  const loader = document.getElementById(id);
  if (loader) {
    loader.remove();
  }
}

// TOAST NOTIFICATIONS HELPER
function showToast(title, desc, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';

  toast.innerHTML = `
    <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${escapeHTML(title)}</div>
      <div class="toast-desc">${escapeHTML(desc)}</div>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Remove notification after timeout
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// XSS ESCAPE HELPER
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

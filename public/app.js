// ==========================================================================
// ShieldAuth Application State & Configuration
// ==========================================================================

const API_BASE = '/api/auth';
let currentUser = null;
let currentToken = null;

// Initial Page Load Hook
document.addEventListener('DOMContentLoaded', () => {
  checkAuthSession();
  checkServerConnection();
});

// ==========================================================================
// Authentication Session Management
// ==========================================================================

/**
 * Validates stored token and redirects accordingly
 */
async function checkAuthSession() {
  const token = localStorage.getItem('jwt_token');
  
  if (!token) {
    showSection('auth-section');
    return;
  }

  // Quick client side validation
  const decoded = parseJwt(token);
  if (!decoded) {
    clearSession();
    showSection('auth-section');
    return;
  }

  // Check expiration (exp is in seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  if (decoded.exp && decoded.exp < currentTime) {
    showToast('Session Expired', 'Your authentication session has expired. Please log in again.', 'warning');
    clearSession();
    showSection('auth-section');
    return;
  }

  currentToken = token;
  
  // Try fetching fresh details from database to ensure token validity
  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${currentToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = data.user;
      loadDashboard(decoded);
    } else {
      console.warn('Session verification failed on server:', data.error);
      clearSession();
      showSection('auth-section');
    }
  } catch (err) {
    console.error('Network error during session check:', err);
    // If server is offline, fall back to offline client token state
    currentUser = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
      created_at: 'N/A (Offline Mode)'
    };
    loadDashboard(decoded);
    showToast('Offline Mode', 'Could not sync with server. Showing cached session details.', 'info');
  }
}

/**
 * Set session credentials and proceed
 */
function establishSession(token, user) {
  localStorage.setItem('jwt_token', token);
  currentToken = token;
  currentUser = user;
}

/**
 * Clear local session credentials
 */
function clearSession() {
  localStorage.removeItem('jwt_token');
  currentToken = null;
  currentUser = null;
}

/**
 * Clean UI dashboard and redirect to Auth
 */
function handleLogout() {
  clearSession();
  showSection('auth-section');
  showToast('Logged Out', 'You have been logged out of your session successfully.', 'info');
}

// ==========================================================================
// API Interaction & Form Event Handlers
// ==========================================================================

/**
 * Handle user registration submission
 */
async function handleRegister(event) {
  event.preventDefault();
  
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  
  const submitBtn = document.getElementById('register-submit-btn');
  setButtonLoading(submitBtn, true);

  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Registration Successful', data.message || 'Your account has been configured.', 'success');
      establishSession(data.token, data.user);
      
      // Clear forms
      document.getElementById('register-form').reset();
      updatePasswordStrength('');
      
      // Check session
      checkAuthSession();
    } else {
      showToast('Registration Failed', data.error || 'Please review your inputs.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to communicate with authentication server.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle user login submission
 */
async function handleLogin(event) {
  event.preventDefault();

  const identity = document.getElementById('login-identity').value.trim();
  const password = document.getElementById('login-password').value;

  const submitBtn = document.getElementById('login-submit-btn');
  setButtonLoading(submitBtn, true);

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Welcome Back!', data.message || 'Login authenticated successfully.', 'success');
      establishSession(data.token, data.user);
      
      // Clear login form
      document.getElementById('login-form').reset();
      
      checkAuthSession();
    } else {
      showToast('Login Failed', data.error || 'Invalid username or password.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to connect to authentication server.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle profile update details
 */
async function handleUpdateProfile(event) {
  event.preventDefault();

  const username = document.getElementById('update-username').value.trim();
  const email = document.getElementById('update-email').value.trim();
  const newPassword = document.getElementById('update-new-password').value;
  const password = document.getElementById('update-auth-password').value;

  const submitBtn = document.getElementById('update-submit-btn');
  setButtonLoading(submitBtn, true);

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ username, email, newPassword, password })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Profile Updated', data.message || 'Your credentials have been updated.', 'success');
      establishSession(data.token, data.user);
      
      // Clear sensitive auth verify field
      document.getElementById('update-auth-password').value = '';
      document.getElementById('update-new-password').value = '';
      
      checkAuthSession();
    } else {
      showToast('Update Failed', data.error || 'Failed to update details.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Failed to submit modifications to server.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

/**
 * Handle account deletion
 */
async function handleDeleteAccount(event) {
  event.preventDefault();

  const password = document.getElementById('delete-auth-password').value;
  const submitBtn = document.getElementById('delete-submit-btn');
  setButtonLoading(submitBtn, true);

  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok) {
      showToast('Account Deleted', data.message || 'Your account has been deleted permanently.', 'success');
      closeDeleteModal();
      clearSession();
      showSection('auth-section');
    } else {
      showToast('Deletion Blocked', data.error || 'Verification failed. Password incorrect.', 'error');
    }
  } catch (err) {
    showToast('Network Error', 'Server failure during request processing.', 'error');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

// ==========================================================================
// Dashboard Renderer & Helper Operations
// ==========================================================================

/**
 * Populate values on Dashboard view and JWT panel
 */
function loadDashboard(decodedToken) {
  // Update Profile Panel
  document.getElementById('display-username').textContent = currentUser.username;
  document.getElementById('display-email').textContent = currentUser.email;
  document.getElementById('display-id').textContent = `#${currentUser.id}`;
  
  // Parse created date
  let joinDate = 'N/A';
  if (currentUser.created_at) {
    const date = new Date(currentUser.created_at);
    if (!isNaN(date)) {
      joinDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } else {
      joinDate = currentUser.created_at; // Custom placeholder string
    }
  }
  document.getElementById('display-joined').textContent = joinDate;

  // Insert custom SVG avatar
  const avatarContainer = document.getElementById('user-avatar-container');
  avatarContainer.innerHTML = generateAvatarSVG(currentUser.username);

  // Prefill Update Profile Form fields
  document.getElementById('update-username').value = currentUser.username;
  document.getElementById('update-email').value = currentUser.email;

  // Load JWT Visualizer details
  renderJwtVisualizer(currentToken, decodedToken);

  showSection('dashboard-section');
}

/**
 * Decodes and renders JWT with mock syntax styling
 */
function renderJwtVisualizer(token, decodedPayload) {
  document.getElementById('raw-jwt-display').textContent = token;

  // Re-split token parts
  const parts = token.split('.');
  const headerB64 = parts[0];
  
  // Client decode header
  let decodedHeader = {};
  try {
    decodedHeader = JSON.parse(atob(headerB64));
  } catch (e) {
    decodedHeader = { alg: "HS256", typ: "JWT" };
  }

  // Render pretty JSON structures
  document.getElementById('jwt-header-display').textContent = JSON.stringify(decodedHeader, null, 2);
  document.getElementById('jwt-payload-display').textContent = JSON.stringify(decodedPayload, null, 2);
}

/**
 * Copy encoded JWT to clipboard
 */
function copyTokenToClipboard() {
  const token = document.getElementById('raw-jwt-display').textContent;
  if (!token || token === 'No active token') return;

  navigator.clipboard.writeText(token).then(() => {
    const copyText = document.getElementById('copy-text');
    copyText.textContent = 'Copied!';
    showToast('Copied', 'JSON Web Token copied to clipboard.', 'success');
    
    setTimeout(() => {
      copyText.textContent = 'Copy';
    }, 2000);
  }).catch(err => {
    showToast('Copy Failed', 'Unable to copy text automatically.', 'error');
  });
}

// ==========================================================================
// Interactive UI Mechanics
// ==========================================================================

/**
 * Toggle views (auth forms vs dashboard)
 */
function showSection(sectionId) {
  document.querySelectorAll('.card-section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(sectionId).classList.add('active');
}

/**
 * Toggle active sign-in vs signup state
 */
function switchAuthTab(tabName) {
  const isLogin = tabName === 'login';
  
  // Tab buttons
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-register').classList.toggle('active', !isLogin);
  
  // Containers
  document.getElementById('login-container').classList.toggle('active', isLogin);
  document.getElementById('register-container').classList.toggle('active', !isLogin);
}

/**
 * Helper to show/hide plaintext password inputs
 */
function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

/**
 * Regex check on typing for username field
 */
function validateUsernameInput(input) {
  const val = input.value;
  const filtered = val.replace(/[^a-zA-Z0-9_]/g, '');
  
  if (val !== filtered) {
    input.value = filtered;
    showToast('Invalid Character', 'Usernames can only contain letters, numbers, and underscores.', 'warning');
  }
}

/**
 * Real-time Password Strength Meter Calculation
 */
function updatePasswordStrength(password) {
  const strengthBar = document.getElementById('strength-bar');
  const strengthLabel = document.getElementById('strength-label');
  
  if (!password) {
    strengthBar.style.width = '0%';
    strengthBar.style.backgroundColor = 'transparent';
    strengthLabel.textContent = 'Password strength: Empty';
    return;
  }

  let score = 0;
  
  // Length check
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  
  // Complexity checks
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  let labelText = 'Weak';
  let barWidth = '20%';
  let barColor = 'var(--danger)';

  if (score >= 4) {
    labelText = 'Strong';
    barWidth = '100%';
    barColor = 'var(--success)';
  } else if (score >= 2) {
    labelText = 'Moderate';
    barWidth = '60%';
    barColor = 'var(--warning)';
  }

  strengthBar.style.width = barWidth;
  strengthBar.style.backgroundColor = barColor;
  strengthLabel.textContent = `Password strength: ${labelText}`;
}

/**
 * Handle form loaders
 */
function setButtonLoading(btn, isLoading) {
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ==========================================================================
// Dynamic Avatar Generator
// ==========================================================================

/**
 * Generates procedural SVGs based on hashing a username string
 */
function generateAvatarSVG(name) {
  // Simple hashing
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Extract base values
  const hue1 = Math.abs(hash % 360);
  const hue2 = Math.abs((hash * 13) % 360);
  
  // Procedural geometry selection
  const shapes = [
    // Circle details
    `<circle cx="12" cy="12" r="7" fill="url(#grad-${hue1})" />`,
    // Rhombus details
    `<rect x="6" y="6" width="12" height="12" rx="2" transform="rotate(45 12 12)" fill="url(#grad-${hue1})" />`,
    // Polygon shields
    `<polygon points="12,4 18,7 18,13 12,19 6,13 6,7" fill="url(#grad-${hue1})" />`
  ];
  const shapeIndex = Math.abs((hash >> 2) % shapes.length);
  
  const innerPatterns = [
    `<circle cx="12" cy="12" r="3" fill="#ffffff" opacity="0.8"/>`,
    `<path d="M8 12 L11 15 L16 9" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.9"/>`,
    `<rect x="9" y="9" width="6" height="6" rx="1" fill="#ffffff" opacity="0.85"/>`
  ];
  const patternIndex = Math.abs((hash >> 4) % innerPatterns.length);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="grad-${hue1}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="hsl(${hue1}, 80%, 65%)" />
          <stop offset="100%" stop-color="hsl(${hue2}, 70%, 45%)" />
        </linearGradient>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e1b4b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bgGrad)" />
      <g transform="scale(0.85) translate(1.8, 1.8)">
        ${shapes[shapeIndex]}
        ${innerPatterns[patternIndex]}
      </g>
    </svg>
  `;
}

// ==========================================================================
// Delete Modal Overlays
// ==========================================================================

function openDeleteModal() {
  document.getElementById('delete-modal').classList.add('active');
  document.getElementById('delete-auth-password').focus();
}

function closeDeleteModal() {
  document.getElementById('delete-modal').classList.remove('active');
  document.getElementById('delete-account-form').reset();
}

// ==========================================================================
// Toast Notification Overlay Manager
// ==========================================================================

/**
 * Spawn dynamically dismissible UI alerts
 */
function showToast(title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon configurations
  let iconSvg = '';
  switch (type) {
    case 'success':
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      break;
    case 'error':
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      break;
    case 'warning':
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      break;
    default: // info
      iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    ${iconSvg}
    <div class="toast-content">
      <span class="toast-title">${title}</span>
      <span class="toast-message">${message}</span>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px) scale(0.95)';
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 4000);
}

// ==========================================================================
// Utility Operations
// ==========================================================================

/**
 * Base64 parser for JWT tokens (client side helper)
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

/**
 * Server Status Poller
 */
async function checkServerConnection() {
  const statusEl = document.getElementById('connection-status');
  try {
    // Ping profiles (which will return 401 but indicates server is up)
    const response = await fetch(`${API_BASE}/profile`);
    statusEl.textContent = 'Server Online';
    statusEl.classList.remove('offline');
    statusEl.classList.add('online');
  } catch (e) {
    statusEl.textContent = 'Server Offline';
    statusEl.classList.remove('online');
    statusEl.classList.add('offline');
  }
}

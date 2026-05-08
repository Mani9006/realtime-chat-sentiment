/**
 * Chat Sentiment App - Client-side Logic
 * Handles Socket.IO connection, UI rendering, and sentiment display
 */

(function () {
  'use strict';

  // =========================================================================
  // State
  // =========================================================================

  const state = {
    socket: null,
    username: null,
    roomId: null,
    roomName: null,
    isConnected: false,
    showSentiment: true,
    typingTimeout: null,
    isTyping: false,
    messages: []
  };

  // =========================================================================
  // DOM Elements
  // =========================================================================

  const $ = (id) => document.getElementById(id);

  const els = {
    // Login
    loginScreen: $('login-screen'),
    loginForm: $('login-form'),
    usernameInput: $('username-input'),
    roomList: $('room-list'),
    joinBtn: $('join-btn'),
    loginError: $('login-error'),

    // Chat
    chatScreen: $('chat-screen'),
    currentRoomName: $('current-room-name'),
    currentRoomDesc: $('current-room-desc'),
    chatRoomTitle: $('chat-room-title'),
    onlineCount: $('online-count'),
    onlineUsers: $('online-users'),
    roomsList: $('rooms-list'),
    messages: $('messages'),
    messagesContainer: $('messages-container'),
    messageForm: $('message-form'),
    messageInput: $('message-input'),
    sendBtn: $('send-btn'),
    typingBar: $('typing-bar'),
    typingText: $('typing-text'),
    leaveBtn: $('leave-btn'),

    // Sentiment
    sentimentPreview: $('sentiment-preview'),
    sentimentEmoji: $('sentiment-emoji'),
    sentimentLabel: $('sentiment-label'),
    toggleSentimentBtn: $('toggle-sentiment-btn'),

    // Search
    searchBtn: $('search-btn'),
    searchModal: $('search-modal'),
    modalClose: $('modal-close'),
    searchInput: $('search-input'),
    searchResults: $('search-results')
  };

  // =========================================================================
  // Initialization
  // =========================================================================

  function init() {
    loadRooms();
    bindEvents();
    setupSocket();
  }

  // =========================================================================
  // Socket Setup
  // =========================================================================

  function setupSocket() {
    state.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    state.socket.on('connect', () => {
      console.log('Connected to server');
      state.isConnected = true;
    });

    state.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      state.isConnected = false;
    });

    state.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      showLoginError('Unable to connect to server. Please try again.');
    });

    state.socket.on('message:new', (message) => {
      addMessage(message);
      scrollToBottom();
    });

    state.socket.on('user:joined', (data) => {
      updateOnlineUsers(data.users);
      els.onlineCount.textContent = data.users.length;
    });

    state.socket.on('user:left', (data) => {
      updateOnlineUsers(data.users);
      els.onlineCount.textContent = data.users.length;
    });

    state.socket.on('typing:update', (data) => {
      updateTypingIndicator(data.typingUsers);
    });

    state.socket.on('room:created', (room) => {
      appendRoomToList(room);
    });
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================

  function bindEvents() {
    // Login form
    els.loginForm.addEventListener('submit', handleLogin);

    // Message form
    els.messageForm.addEventListener('submit', handleSendMessage);

    // Message input - typing indicator and live sentiment
    els.messageInput.addEventListener('input', handleInput);

    // Leave button
    els.leaveBtn.addEventListener('click', handleLeave);

    // Toggle sentiment
    els.toggleSentimentBtn.addEventListener('click', () => {
      state.showSentiment = !state.showSentiment;
      els.toggleSentimentBtn.textContent = state.showSentiment ? '😊' : '😐';
      els.toggleSentimentBtn.title = state.showSentiment ? 'Hide sentiment' : 'Show sentiment';
      reRenderMessages();
    });

    // Search modal
    els.searchBtn.addEventListener('click', openSearchModal);
    els.modalClose.addEventListener('click', closeSearchModal);
    els.searchModal.querySelector('.modal-overlay').addEventListener('click', closeSearchModal);
    els.searchInput.addEventListener('input', debounce(handleSearch, 300));

    // Enter key in search
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearchModal();
    });

    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape' && !els.searchModal.classList.contains('hidden')) {
        closeSearchModal();
      }
    });
  }

  // =========================================================================
  // Login
  // =========================================================================

  async function loadRooms() {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();

      if (data.rooms && data.rooms.length > 0) {
        renderRoomOptions(data.rooms);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
      // Fallback rooms
      renderRoomOptions([
        { id: 'general', name: 'General Chat', description: 'Open discussion' },
        { id: 'tech', name: 'Technology', description: 'Tech talks' },
        { id: 'random', name: 'Random', description: 'Off-topic' },
        { id: 'support', name: 'Support', description: 'Help channel' }
      ]);
    }
  }

  function renderRoomOptions(rooms) {
    els.roomList.innerHTML = rooms.map((room, i) => `
      <label class="room-option ${i === 0 ? 'selected' : ''}" data-room-id="${room.id}">
        <input type="radio" name="room" value="${room.id}" ${i === 0 ? 'checked' : ''}>
        <span class="room-option-info">
          <span class="room-option-name">${escapeHtml(room.name)}</span>
          <span class="room-option-desc">${escapeHtml(room.description)}</span>
        </span>
      </label>
    `).join('');

    // Room selection
    els.roomList.querySelectorAll('.room-option').forEach(opt => {
      opt.addEventListener('click', () => {
        els.roomList.querySelectorAll('.room-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
      });
    });
  }

  function handleLogin(e) {
    e.preventDefault();

    const username = els.usernameInput.value.trim();
    const selectedRoom = els.roomList.querySelector('input[name="room"]:checked');

    if (!username) {
      showLoginError('Please enter a username');
      return;
    }

    if (!selectedRoom) {
      showLoginError('Please select a room');
      return;
    }

    const roomId = selectedRoom.value;

    els.joinBtn.disabled = true;
    els.joinBtn.textContent = 'Joining...';

    state.socket.emit('user:join', { username, roomId }, (response) => {
      els.joinBtn.disabled = false;
      els.joinBtn.textContent = 'Join Chat';

      if (response.error) {
        showLoginError(response.error);
        return;
      }

      // Success
      state.username = response.user.username;
      state.roomId = response.user.roomId;

      hideLoginError();
      showChatScreen(response);

      // Load and display recent messages
      if (response.messages && response.messages.length > 0) {
        response.messages.forEach(msg => addMessage(msg));
        scrollToBottom();
      }
    });
  }

  function showLoginError(msg) {
    els.loginError.textContent = msg;
    els.loginError.classList.add('visible');
  }

  function hideLoginError() {
    els.loginError.textContent = '';
    els.loginError.classList.remove('visible');
  }

  // =========================================================================
  // Chat UI
  // =========================================================================

  function showChatScreen(response) {
    els.loginScreen.classList.add('hidden');
    els.chatScreen.classList.remove('hidden');

    els.currentRoomName.textContent = state.roomId.charAt(0).toUpperCase() + state.roomId.slice(1);
    els.chatRoomTitle.textContent = state.roomId.charAt(0).toUpperCase() + state.roomId.slice(1);

    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;
    els.messageInput.focus();

    // Load sidebar data
    loadSidebarRooms();
    updateOnlineUsers([]);
  }

  async function loadSidebarRooms() {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      renderSidebarRooms(data.rooms || []);
    } catch (error) {
      console.error('Failed to load sidebar rooms:', error);
    }
  }

  function renderSidebarRooms(rooms) {
    els.roomsList.innerHTML = rooms.map(room => `
      <li class="${room.id === state.roomId ? 'active' : ''}" data-room="${room.id}">
        <span>#</span> ${escapeHtml(room.name)}
      </li>
    `).join('');
  }

  function updateOnlineUsers(users) {
    els.onlineCount.textContent = users.length;

    if (!users || users.length === 0) {
      els.onlineUsers.innerHTML = '<li style="color: var(--color-text-muted); font-size: 13px;">No users online</li>';
      return;
    }

    els.onlineUsers.innerHTML = users.map(user => `
      <li>
        <span class="user-avatar">${user.username.charAt(0).toUpperCase()}</span>
        <span class="user-name">${escapeHtml(user.username)} ${user.username === state.username ? '(you)' : ''}</span>
        ${user.isTyping ? '<span class="typing-badge">typing...</span>' : ''}
      </li>
    `).join('');
  }

  // =========================================================================
  // Messages
  // =========================================================================

  function handleSendMessage(e) {
    e.preventDefault();

    const text = els.messageInput.value.trim();
    if (!text || !state.roomId) return;

    // Clear input
    els.messageInput.value = '';
    clearSentimentPreview();

    // Stop typing
    handleTypingStop();

    // Send message
    state.socket.emit('message:send', { text, roomId: state.roomId }, (response) => {
      if (response.error) {
        console.error('Failed to send message:', response.error);
      }
    });

    // Refocus
    els.messageInput.focus();
  }

  function handleInput() {
    const text = els.messageInput.value.trim();

    // Live sentiment preview (simple client-side check)
    updateLiveSentiment(text);

    // Typing indicator
    if (text.length > 0 && !state.isTyping) {
      state.isTyping = true;
      state.socket.emit('typing:start', { roomId: state.roomId });
    }

    // Debounce typing stop
    clearTimeout(state.typingTimeout);
    state.typingTimeout = setTimeout(() => {
      handleTypingStop();
    }, 3000);
  }

  function handleTypingStop() {
    if (state.isTyping) {
      state.isTyping = false;
      state.socket.emit('typing:stop', { roomId: state.roomId });
    }
  }

  function updateTypingIndicator(typingUsers) {
    if (!typingUsers || typingUsers.length === 0) {
      els.typingBar.classList.add('hidden');
      return;
    }

    els.typingBar.classList.remove('hidden');

    if (typingUsers.length === 1) {
      els.typingText.textContent = `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      els.typingText.textContent = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else {
      els.typingText.textContent = `${typingUsers.length]} people are typing...`;
    }
  }

  // =========================================================================
  // Message Rendering
  // =========================================================================

  function addMessage(message) {
    state.messages.push(message);

    const el = document.createElement('div');
    el.className = getMessageClasses(message);
    el.id = `msg-${message.id}`;
    el.innerHTML = renderMessageHTML(message);

    els.messages.appendChild(el);

    // Keep max 200 messages in DOM
    while (els.messages.children.length > 200) {
      els.messages.removeChild(els.messages.firstChild);
    }
  }

  function getMessageClasses(message) {
    const classes = ['message'];

    if (message.type === 'system' || message.type === 'join' || message.type === 'leave') {
      classes.push('system');
    } else if (message.username === state.username) {
      classes.push('own', 'chat');
    } else {
      classes.push('chat');
    }

    return classes.join(' ');
  }

  function renderMessageHTML(message) {
    const time = formatTime(message.timestamp);

    // System message
    if (message.type === 'system' || message.type === 'join' || message.type === 'leave') {
      return `<div class="message-body">${escapeHtml(message.text)}</div>`;
    }

    const sentimentHTML = message.sentiment && state.showSentiment
      ? renderSentimentHTML(message.sentiment)
      : '';

    const isOwn = message.username === state.username;

    return `
      <div class="message-header">
        <span class="message-author">${escapeHtml(message.username)}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-body ${message.sentiment ? 'sentiment-' + message.sentiment.label : ''}">
        ${escapeHtml(message.text)}
      </div>
      ${sentimentHTML}
    `;
  }

  function renderSentimentHTML(sentiment) {
    if (!sentiment) return '';
    return `
      <div class="message-meta">
        <span class="sentiment-badge sentiment-${sentiment.label}">
          <span class="message-emoji">${sentiment.emoji || '😐'}</span>
          ${sentiment.label.replace(/-/g, ' ')}
        </span>
        <span class="sentiment-score">score: ${sentiment.score}</span>
      </div>
    `;
  }

  function reRenderMessages() {
    els.messages.innerHTML = '';
    state.messages.forEach(msg => {
      const el = document.createElement('div');
      el.className = getMessageClasses(msg);
      el.id = `msg-${msg.id}`;
      el.innerHTML = renderMessageHTML(msg);
      els.messages.appendChild(el);
    });
    scrollToBottom();
  }

  // =========================================================================
  // Live Sentiment Preview
  // =========================================================================

  function updateLiveSentiment(text) {
    if (!text || text.length === 0) {
      els.sentimentPreview.classList.add('hidden');
      return;
    }

    // Simple keyword-based check for live preview
    const result = quickSentimentCheck(text);

    els.sentimentPreview.classList.remove('hidden');
    els.sentimentEmoji.textContent = result.emoji;
    els.sentimentLabel.textContent = result.label;
    els.sentimentLabel.className = `sentiment-${result.label}`;
  }

  function clearSentimentPreview() {
    els.sentimentPreview.classList.add('hidden');
  }

  function quickSentimentCheck(text) {
    const lower = text.toLowerCase();

    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy', 'nice', 'excellent', 'amazing', 'best', 'fantastic', 'wonderful', 'thanks', 'thank', 'glad', 'cool', 'fun'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'sad', 'angry', 'annoying', 'worst', 'horrible', 'sorry', 'unhappy', 'disappointed', 'frustrated', 'stupid', 'boring'];

    let score = 0;
    positiveWords.forEach(w => { if (lower.includes(w)) score++; });
    negativeWords.forEach(w => { if (lower.includes(w)) score--; });

    if (score >= 2) return { emoji: '🤩', label: 'very-positive' };
    if (score >= 1) return { emoji: '😊', label: 'positive' };
    if (score <= -2) return { emoji: '😠', label: 'very-negative' };
    if (score <= -1) return { emoji: '😞', label: 'negative' };
    return { emoji: '😐', label: 'neutral' };
  }

  // =========================================================================
  // Search
  // =========================================================================

  function openSearchModal() {
    els.searchModal.classList.remove('hidden');
    els.searchInput.value = '';
    els.searchResults.innerHTML = '';
    els.searchInput.focus();
  }

  function closeSearchModal() {
    els.searchModal.classList.add('hidden');
  }

  async function handleSearch() {
    const query = els.searchInput.value.trim();
    if (!query || query.length < 2) {
      els.searchResults.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/rooms/${state.roomId}/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.messages && data.messages.length > 0) {
        els.searchResults.innerHTML = data.messages.map(msg => `
          <div class="search-result-item" data-msg-id="${msg.id}">
            <div class="search-result-author">${escapeHtml(msg.username)}</div>
            <div class="search-result-text">${escapeHtml(msg.text)}</div>
            <div class="search-result-time">${formatTime(msg.timestamp)}</div>
          </div>
        `).join('');
      } else {
        els.searchResults.innerHTML = '<div class="search-empty">No messages found</div>';
      }
    } catch (error) {
      console.error('Search failed:', error);
      els.searchResults.innerHTML = '<div class="search-empty">Search failed</div>';
    }
  }

  // =========================================================================
  // Leave
  // =========================================================================

  function handleLeave() {
    if (state.socket) {
      state.socket.disconnect();
    }

    // Reset state
    state.username = null;
    state.roomId = null;
    state.messages = [];
    state.isTyping = false;

    // Reset UI
    els.messages.innerHTML = '';
    els.messageInput.value = '';
    els.messageInput.disabled = true;
    els.sendBtn.disabled = true;

    // Show login
    els.chatScreen.classList.add('hidden');
    els.loginScreen.classList.remove('hidden');
    els.usernameInput.value = '';

    // Reconnect
    setupSocket();
  }

  // =========================================================================
  // Utilities
  // =========================================================================

  function scrollToBottom() {
    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, ms) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  // =========================================================================
  // Start
  // =========================================================================

  init();
})();

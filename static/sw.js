// Enhanced WBGT Service Worker with Background Sync and Persistent Notifications
const CACHE_NAME = 'wbgt-v2';
const urlsToCache = [
  '/',
  '/static/main.js',
  '/static/icon-192.png'
];

// Store for tracking work completion states
let workCompletionStates = new Map();
let activeUsernames = new Set();
let checkInterval = null;

// Install event
self.addEventListener('install', function(event) {
  console.log('[SW] Installing enhanced WBGT service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[SW] Cache populated successfully');
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating enhanced WBGT service worker...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Service worker activated and ready');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event with caching
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        return response || fetch(event.request);
      })
  );
});

// Background sync for work completion checking
self.addEventListener('sync', function(event) {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'wbgt-work-check') {
    event.waitUntil(checkAllUsersWorkCompletion());
  }
});

// Message handling from main thread
self.addEventListener('message', function(event) {
  console.log('[SW] Message received:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'START_MONITORING':
      startMonitoring(data.username);
      break;
    case 'STOP_MONITORING':
      stopMonitoring(data.username);
      break;
    case 'CHECK_USER':
      checkUserWorkCompletion(data.username);
      break;
    case 'MARK_NOTIFIED':
      markUserNotified(data.username);
      break;
  }
});

// Start monitoring a user
function startMonitoring(username) {
  console.log('[SW] Starting monitoring for:', username);
  activeUsernames.add(username);
  
  // Initialize state if not exists
  if (!workCompletionStates.has(username)) {
    workCompletionStates.set(username, {
      lastCheckTime: Date.now(),
      workCompleted: false,
      pendingRest: false,
      zone: null,
      notificationShown: false
    });
  }
  
  // Start periodic checking if not already running
  if (!checkInterval) {
    startPeriodicCheck();
  }
}

// Stop monitoring a user
function stopMonitoring(username) {
  console.log('[SW] Stopping monitoring for:', username);
  activeUsernames.delete(username);
  workCompletionStates.delete(username);
  
  // Stop periodic checking if no active users
  if (activeUsernames.size === 0 && checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[SW] Stopped periodic checking - no active users');
  }
}

// Start periodic checking every 3 seconds
function startPeriodicCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  console.log('[SW] Starting periodic work completion check');
  checkInterval = setInterval(() => {
    if (activeUsernames.size > 0) {
      checkAllUsersWorkCompletion();
    }
  }, 3000); // Check every 3 seconds for responsiveness
}

// Check all active users for work completion
async function checkAllUsersWorkCompletion() {
  const promises = Array.from(activeUsernames).map(username => 
    checkUserWorkCompletion(username)
  );
  
  await Promise.all(promises);
}

// Check individual user for work completion
async function checkUserWorkCompletion(username) {
  try {
    const response = await fetch(`/get_user_state/${username}`);
    const userData = await response.json();
    
    const currentState = workCompletionStates.get(username) || {};
    const hasWorkCompleted = userData.work_completed && userData.pending_rest && userData.zone;
    
    // Check if this is a new work completion (transition from not completed to completed)
    const isNewCompletion = hasWorkCompleted && 
      (!currentState.workCompleted || currentState.zone !== userData.zone || currentState.notificationShown === false);
    
    // Update state
    workCompletionStates.set(username, {
      lastCheckTime: Date.now(),
      workCompleted: userData.work_completed,
      pendingRest: userData.pending_rest,
      zone: userData.zone,
      notificationShown: isNewCompletion ? false : currentState.notificationShown
    });
    
    // Show notification if new completion detected
    if (isNewCompletion) {
      await showWorkCompletionNotification(username, userData);
      
      // Mark as notified
      const updatedState = workCompletionStates.get(username);
      updatedState.notificationShown = true;
      workCompletionStates.set(username, updatedState);
    }
    
  } catch (error) {
    console.error('[SW] Error checking user state for', username, ':', error);
  }
}

// Show work completion notification
async function showWorkCompletionNotification(username, userData) {
  const restTime = getRestTimeForZone(userData.zone);
  const timeUnit = userData.zone === 'test' ? 'second' : 'minute';
  
  console.log('[SW] Showing work completion notification for:', username, 'zone:', userData.zone);
  
  // Create persistent notification
  const notificationOptions = {
    body: `Your ${userData.zone.toUpperCase()} work cycle has ended. Start your ${restTime} ${timeUnit} rest cycle now!`,
    icon: '/static/icon-192.png',
    badge: '/static/icon-192.png',
    tag: `work-complete-${username}-${userData.zone}`,
    requireInteraction: true,
    persistent: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      username: username,
      zone: userData.zone,
      restTime: restTime,
      timeUnit: timeUnit,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'start-rest',
        title: 'Start Rest Cycle',
        icon: '/static/icon-192.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/static/icon-192.png'
      }
    ]
  };
  
  await self.registration.showNotification(
    `🚨 Work Complete - ${userData.zone.toUpperCase()} Zone`,
    notificationOptions
  );
  
  // Also send message to any open clients
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'WORK_COMPLETION_DETECTED',
      data: {
        username: username,
        zone: userData.zone,
        restTime: restTime,
        timeUnit: timeUnit
      }
    });
  });
}

// Get rest time for zone (matches server-side logic)
function getRestTimeForZone(zone) {
  const WBGT_ZONES = {
    "white": { "work": 60, "rest": 15 },
    "green": { "work": 45, "rest": 15 },
    "yellow": { "work": 30, "rest": 15 },
    "red": { "work": 30, "rest": 30 },
    "black": { "work": 15, "rest": 30 },
    "test": { "work": 7/60, "rest": 10 },
    "cut-off": { "work": 0, "rest": 30 }
  };
  
  return WBGT_ZONES[zone]?.rest || 15;
}

// Mark user as notified
function markUserNotified(username) {
  const state = workCompletionStates.get(username);
  if (state) {
    state.notificationShown = true;
    workCompletionStates.set(username, state);
    console.log('[SW] Marked user as notified:', username);
  }
}

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.notification.tag);
  
  event.notification.close();
  
  const { username, zone } = event.notification.data;
  
  if (event.action === 'start-rest') {
    // Open the dashboard and trigger rest start
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        let clientToFocus = null;
        
        // Find existing client
        for (let client of clients) {
          if (client.url.includes('/dashboard')) {
            clientToFocus = client;
            break;
          }
        }
        
        if (clientToFocus) {
          // Focus existing client and send message
          clientToFocus.focus();
          clientToFocus.postMessage({
            type: 'START_REST_FROM_NOTIFICATION',
            data: { username, zone }
          });
        } else {
          // Open new client
          self.clients.openWindow('/dashboard').then(client => {
            // Send message after a delay to ensure page is loaded
            setTimeout(() => {
              client.postMessage({
                type: 'START_REST_FROM_NOTIFICATION',
                data: { username, zone }
              });
            }, 1000);
          });
        }
      })
    );
  } else {
    // Just open/focus the dashboard
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        if (clients.length > 0) {
          clients[0].focus();
        } else {
          self.clients.openWindow('/dashboard');
        }
      })
    );
  }
  
  // Mark user as notified
  markUserNotified(username);
});
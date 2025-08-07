// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration with your actual credentials
const firebaseConfig = {
  apiKey: "AIzaSyBaT8NPePn_crgrLUDHscuBzZwOTg54Mpw",
  authDomain: "thermopal-9b302.firebaseapp.com",
  projectId: "thermopal-9b302",
  storageBucket: "thermopal-9b302.firebasestorage.app",
  messagingSenderId: "212325894246",
  appId: "1:212325894246:web:92f39a3ca0553a78bac5a7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages with enhanced persistence and reminder system
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Work Cycle Alert';
  const notificationBody = payload.notification?.body || payload.data?.body || 'Your work cycle has ended. Time for rest!';
  const username = payload.data?.username || 'unknown';
  const zone = payload.data?.zone || 'unknown';

  const notificationOptions = {
    body: notificationBody,
    icon: 'https://thermopal.onrender.com/static/icon.png',
    badge: 'https://thermopal.onrender.com/static/icon.png',
    tag: `wbgt-work-complete-${username}`, // Consistent tag for work completion
    requireInteraction: true,
    vibrate: [1000, 500, 1000, 500, 1000, 500, 1500],
    silent: false,
    renotify: true,
    timestamp: Date.now(),
    persistent: true,
    dir: 'auto',
    lang: 'en',
    actions: [
      {
        action: 'start-rest',
        title: 'Start Rest',
        icon: 'https://thermopal.onrender.com/static/icon.png'
      },
      {
        action: 'view-app',
        title: 'Open App',
        icon: 'https://thermopal.onrender.com/static/icon.png'
      }
    ],
    data: {
      url: payload.data?.url || `https://thermopal.onrender.com/dashboard/${username}`,
      username: username,
      timestamp: Date.now(),
      zone: zone,
      type: 'work_complete'
    }
  };

  // Show notification with enhanced background support
  console.log('[firebase-messaging-sw.js] Showing background notification for:', username);

  // Store notification data for reminder system and show notification
  const notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions);

  notificationPromise.then(() => {
    console.log('[firebase-messaging-sw.js] Background notification shown successfully');
    // Start progressive reminder system in background (first reminder after 5 seconds)
    startBackgroundProgressiveReminderSystem(username, zone);
  }).catch(error => {
    console.error('[firebase-messaging-sw.js] Failed to show background notification:', error);
  });

  return notificationPromise;
});

// Background progressive reminder system
let backgroundReminderInterval = null;
let backgroundFirstReminderTimeout = null;

function startBackgroundProgressiveReminderSystem(username, zone) {
  console.log('[firebase-messaging-sw.js] Starting background progressive reminder system for:', username);

  // Clear any existing reminders
  clearBackgroundReminders();

  // Set up first reminder after 5 seconds (when user dismisses)
  // This will be triggered when the notification is dismissed
}

function startBackgroundReminderSystem(username, zone) {
  // Legacy function - redirect to progressive system
  startBackgroundProgressiveReminderSystem(username, zone);
}

function startBackgroundContinuousReminders(username, zone) {
  console.log('[firebase-messaging-sw.js] Starting continuous background reminders for:', username);

  // Clear any existing reminders
  clearBackgroundReminders();

  // Show initial reminder immediately
  showBackgroundReminder(username, zone);

  // Set up interval for continuous reminders every 10 seconds
  backgroundReminderInterval = setInterval(() => {
    console.log('[firebase-messaging-sw.js] Showing scheduled background reminder (10 second interval)');
    showBackgroundReminder(username, zone);
  }, 10000); // Every 10 seconds as requested

}

function clearBackgroundReminders() {
  if (backgroundReminderInterval) {
    clearInterval(backgroundReminderInterval);
    backgroundReminderInterval = null;
  }
  if (backgroundFirstReminderTimeout) {
    clearTimeout(backgroundFirstReminderTimeout);
    backgroundFirstReminderTimeout = null;
  }
}

function showBackgroundReminder(username, zone) {
  const reminderTitle = "Rest Cycle Reminder!";
  const reminderBody = `${username}, you still need to start your rest cycle after completing ${zone?.toUpperCase() || 'WORK'} zone work.`;

  const reminderOptions = {
    body: reminderBody,
    icon: '/static/icon.png',
    badge: '/static/icon.png',
    tag: 'wbgt-reminder-' + Date.now(),
    requireInteraction: true,
    vibrate: [1000, 300, 1000, 300, 1000],
    silent: false,
    renotify: true,
    timestamp: Date.now(),
    persistent: true,
    actions: [
      {
        action: 'start-rest',
        title: 'Start Rest Now',
        icon: '/static/icon.png'
      },
      {
        action: 'view-app',
        title: 'Open App',
        icon: '/static/icon.png'
      }
    ],
    data: {
      url: 'https://thermopal.onrender.com/dashboard',
      username: username,
      zone: zone,
      timestamp: Date.now(),
      isReminder: true
    }
  };

  console.log('[firebase-messaging-sw.js] Showing background reminder notification');
  self.registration.showNotification(reminderTitle, reminderOptions);
}

// Clear reminders when rest is started or handle dismiss actions
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'clear-reminders') {
    console.log('[firebase-messaging-sw.js] Clearing background reminders');
    clearBackgroundReminders();
  } else if (event.data && event.data.type === 'notification-dismissed') {
    console.log('[firebase-messaging-sw.js] Notification dismissed - starting progressive reminders');
    const { username, zone } = event.data;
    
    // Start first reminder after 5 seconds
    backgroundFirstReminderTimeout = setTimeout(() => {
      console.log('[firebase-messaging-sw.js] First reminder after dismiss (5 seconds)');
      startBackgroundContinuousReminders(username, zone);
    }, 5000);
  }
});

// Handle notification clicks with enhanced mobile support
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click received on mobile:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const dashboardUrl = notificationData.url || 'https://thermopal.onrender.com/dashboard';

  if (event.action === 'start-rest') {
    // Clear background reminders immediately
    if (backgroundReminderInterval) {
      clearInterval(backgroundReminderInterval);
      backgroundReminderInterval = null;
    }

    // Focus existing window or open new one for start rest action
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Try to find existing dashboard window
        for (const client of clientList) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            console.log('Focusing existing dashboard window');
            // Send message to clear client-side reminders too
            client.postMessage({
              type: 'clear-reminders'
            });
            return client.focus();
          }
        }
        // Open new window if no existing one found
        console.log('Opening new dashboard window for start rest');
        if (clients.openWindow) {
          return clients.openWindow(dashboardUrl);
        }
      }).then(client => {
        // Send message to client to trigger start rest action
        if (client) {
          client.postMessage({
            type: 'notification-click',
            action: 'start-rest',
            username: notificationData.username
          });
          // Also send clear reminders message
          client.postMessage({
            type: 'clear-reminders'
          });
        }
      })
    );
  } else if (event.action === 'view-app') {
    // Open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            console.log('Focusing existing app window');
            return client.focus();
          }
        }
        console.log('Opening new app window');
        if (clients.openWindow) {
          return clients.openWindow('https://thermopal.onrender.com');
        }
      })
    );
  } else {
    // Default action - open dashboard
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/dashboard') && 'focus' in client) {
            console.log('Focusing existing dashboard (default action)');
            return client.focus();
          }
        }
        console.log('Opening new dashboard window (default action)');
        if (clients.openWindow) {
          return clients.openWindow(dashboardUrl);
        }
      })
    );
  }
});
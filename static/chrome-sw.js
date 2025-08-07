// Chrome Service Worker for Push Notifications
const CACHE_NAME = 'wbgt-chrome-notifications-v1';

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
    console.log('Chrome notification clicked:', event.notification.tag, event.action);

    const notificationData = event.notification.data || {};
    
    event.notification.close();

    if (event.action === 'start-rest') {
        // Handle start rest action
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                // Try to find existing dashboard window
                for (const client of clientList) {
                    if (client.url.includes('/dashboard') && 'focus' in client) {
                        console.log('Focusing existing dashboard window from Chrome SW');
                        client.postMessage({
                            type: 'notification-action',
                            action: 'start-rest',
                            username: notificationData.username
                        });
                        return client.focus();
                    }
                }
                
                // Open new window if no existing one found
                console.log('Opening new dashboard window from Chrome SW');
                if (clients.openWindow) {
                    return clients.openWindow('/dashboard').then(client => {
                        if (client) {
                            client.postMessage({
                                type: 'notification-action',
                                action: 'start-rest',
                                username: notificationData.username
                            });
                        }
                    });
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Handle dismiss action - start reminder system
        console.log('Chrome notification dismissed via action button');
        
        // Store reminder state and start progressive reminders
        event.waitUntil(
            startChromeReminderSystem(notificationData)
        );
    } else {
        // Default action - open dashboard
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('/dashboard') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/dashboard');
                }
            })
        );
    }
});

// Handle notification close (when user swipes away)
self.addEventListener('notificationclose', function(event) {
    console.log('Chrome notification closed/swiped away:', event.notification.tag);
    
    const notificationData = event.notification.data || {};
    
    // Only start reminders if this is a work completion notification (not a reminder)
    if (!notificationData.isReminder && notificationData.type === 'work_complete') {
        console.log('Starting Chrome reminders after notification close');
        event.waitUntil(
            startChromeReminderSystem(notificationData)
        );
    }
});

// Chrome reminder system variables
let chromeReminderInterval = null;
let chromeFirstReminderTimeout = null;

// Start Chrome reminder system
function startChromeReminderSystem(data) {
    console.log('Starting Chrome reminder system for:', data.username);
    
    // Clear any existing reminders
    clearChromeReminderSystem();
    
    // Start first reminder after 5 seconds
    chromeFirstReminderTimeout = setTimeout(() => {
        console.log('Chrome first reminder after 5 seconds');
        showChromeReminder(data);
        
        // Then continuous reminders every 10 seconds
        chromeReminderInterval = setInterval(() => {
            console.log('Chrome continuous reminder (10 second interval)');
            showChromeReminder(data);
        }, 10000);
        
    }, 5000);
    
    return Promise.resolve();
}

// Clear Chrome reminder system
function clearChromeReminderSystem() {
    if (chromeReminderInterval) {
        clearInterval(chromeReminderInterval);
        chromeReminderInterval = null;
    }
    if (chromeFirstReminderTimeout) {
        clearTimeout(chromeFirstReminderTimeout);
        chromeFirstReminderTimeout = null;
    }
}

// Show Chrome reminder notification
function showChromeReminder(data) {
    const reminderTitle = "Rest Cycle Reminder!";
    const reminderBody = `${data.username}, you still need to start your ${data.rest_duration} ${data.zone === 'test' ? 'second' : 'minute'} rest cycle after completing ${data.zone?.toUpperCase() || 'WORK'} zone work.`;

    const reminderOptions = {
        body: reminderBody,
        icon: '/static/icon-192.png',
        badge: '/static/icon-192.png',
        tag: 'wbgt-chrome-reminder-' + Date.now(),
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500],
        silent: false,
        renotify: true,
        timestamp: Date.now(),
        actions: [
            {
                action: 'start-rest',
                title: 'Start Rest Now',
                icon: '/static/icon-192.png'
            },
            {
                action: 'dismiss',
                title: 'Dismiss',
                icon: '/static/icon-192.png'
            }
        ],
        data: {
            username: data.username,
            zone: data.zone,
            rest_duration: data.rest_duration,
            isReminder: true,
            url: '/dashboard'
        }
    };

    console.log('Showing Chrome reminder notification');
    return self.registration.showNotification(reminderTitle, reminderOptions);
}

// Handle messages from main thread
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'clear-reminders') {
        console.log('Clearing Chrome reminders via message');
        clearChromeReminderSystem();
    } else if (event.data && event.data.type === 'notification-dismissed') {
        console.log('Chrome notification dismissed via message');
        const { username, zone, rest_duration } = event.data;
        startChromeReminderSystem({ username, zone, rest_duration });
    }
});

// Install and activate service worker
self.addEventListener('install', function(event) {
    console.log('Chrome Service Worker installing...');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('Chrome Service Worker activating...');
    event.waitUntil(self.clients.claim());
});
// Chrome-compatible push notifications system
class ChromeNotificationManager {
    constructor() {
        // Enhanced Chrome detection
        this.isChrome = this.detectChrome();
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
        this.registration = null;
        this.currentUser = null;
        console.log('Chrome detected:', this.isChrome, 'Notifications supported:', this.isSupported);
    }

    detectChrome() {
        // More reliable Chrome detection
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const isEdge = /Edg/.test(navigator.userAgent);
        return isChrome && !isEdge;
    }

    async initialize(username) {
        this.currentUser = username;
        console.log('Initializing Chrome notification manager for:', username);

        if (!this.isSupported) {
            console.log('Push notifications not supported in this browser');
            return false;
        }

        if (!this.isChrome) {
            console.log('Not Chrome browser, skipping Chrome-specific initialization');
            return false;
        }

        try {
            // Check if service worker already exists
            const existingRegistration = await navigator.serviceWorker.getRegistration('/');
            if (existingRegistration) {
                console.log('Using existing service worker registration');
                this.registration = existingRegistration;
            } else {
                // Register service worker for Chrome
                this.registration = await navigator.serviceWorker.register('/static/chrome-sw.js', {
                    scope: '/'
                });
                console.log('Chrome service worker registered:', this.registration);
            }

            await navigator.serviceWorker.ready;
            
            // Check current permission status
            console.log('Current notification permission:', Notification.permission);
            
            if (Notification.permission === 'granted') {
                console.log('Chrome notifications already granted');
                return true;
            } else if (Notification.permission === 'denied') {
                console.log('Chrome notifications permanently denied');
                return false;
            } else {
                console.log('Chrome notifications need permission - user interaction required');
                return false; // Return false so UI can show permission button
            }

        } catch (error) {
            console.error('Error initializing Chrome notifications:', error);
            return false;
        }
    }

    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('Notification API not available');
            return 'denied';
        }

        console.log('Current permission status:', Notification.permission);

        if (Notification.permission === 'granted') {
            return 'granted';
        }

        if (Notification.permission === 'denied') {
            console.log('Notifications permanently denied by user');
            return 'denied';
        }

        try {
            // For Chrome, we need to request permission with user interaction
            console.log('Requesting notification permission...');
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    // Show work completion notification for Chrome
    showWorkCompleteNotification(data) {
        console.log('Attempting to show Chrome work completion notification:', data);
        console.log('Notification permission:', Notification.permission);
        console.log('Service worker registration:', this.registration);

        if (!this.isSupported) {
            console.log('Notifications not supported in this browser');
            return false;
        }

        if (Notification.permission !== 'granted') {
            console.log('Notification permission not granted. Current status:', Notification.permission);
            return false;
        }

        const title = data.title || 'Work Cycle Complete!';
        const body = data.message || `Your ${data.zone?.toUpperCase() || 'WORK'} zone work cycle has ended. Time to start your rest cycle!`;

        const options = {
            body: body,
            icon: '/static/icon-192.png',
            badge: '/static/icon-192.png',
            tag: 'wbgt-work-complete-' + Date.now(), // Unique tag to prevent duplicates
            requireInteraction: true,
            silent: false,
            vibrate: [800, 300, 800, 300, 800],
            timestamp: Date.now(),
            actions: [
                {
                    action: 'start-rest',
                    title: 'Start Rest',
                    icon: '/static/icon-192.png'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss',
                    icon: '/static/icon-192.png'
                }
            ],
            data: {
                username: data.username || this.currentUser,
                zone: data.zone,
                rest_duration: data.rest_duration,
                url: '/dashboard',
                type: 'work_complete'
            }
        };

        try {
            // Prefer service worker notifications for better control
            if (this.registration && this.registration.showNotification) {
                console.log('Showing notification via service worker');
                this.registration.showNotification(title, options)
                    .then(() => {
                        console.log('Chrome service worker notification shown successfully');
                    })
                    .catch(error => {
                        console.error('Service worker notification failed:', error);
                        this.fallbackToDirectNotification(title, options);
                    });
            } else {
                console.log('Service worker not available, using direct notification');
                this.fallbackToDirectNotification(title, options);
            }

            // Add Chrome-specific vibration
            if ('vibrate' in navigator) {
                navigator.vibrate([800, 300, 800, 300, 800]);
            }

            console.log('Chrome notification request completed');
            return true;

        } catch (error) {
            console.error('Error showing Chrome notification:', error);
            return false;
        }
    }

    // Fallback to direct browser notification
    fallbackToDirectNotification(title, options) {
        try {
            console.log('Creating direct browser notification');
            const notification = new Notification(title, options);
            
            notification.onclick = () => {
                console.log('Direct notification clicked');
                window.focus();
                notification.close();
                this.handleNotificationClick('default', options.data);
            };

            notification.onshow = () => {
                console.log('Direct notification shown');
            };

            notification.onerror = (error) => {
                console.error('Direct notification error:', error);
            };

        } catch (error) {
            console.error('Failed to create direct notification:', error);
        }
    }

    // Handle notification click actions
    handleNotificationClick(action, data) {
        console.log('Chrome notification clicked:', action, data);

        switch (action) {
            case 'start-rest':
                this.startRestCycle(data.username);
                break;
            case 'dismiss':
                this.dismissNotification(data);
                break;
            default:
                window.focus();
                break;
        }
    }

    // Start rest cycle from notification
    async startRestCycle(username) {
        try {
            const response = await fetch('/start_rest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: username
                })
            });

            const data = await response.json();
            if (data.success) {
                console.log('Rest cycle started successfully from Chrome notification');
                // Update dashboard if function exists
                if (typeof window.updateDashboard === 'function') {
                    window.updateDashboard();
                }
            } else {
                console.error('Failed to start rest cycle:', data.error);
            }
        } catch (error) {
            console.error('Error starting rest cycle from Chrome notification:', error);
        }
    }

    // Dismiss notification and start reminder system
    dismissNotification(data) {
        console.log('Chrome notification dismissed:', data);
        
        // Send message to service worker for reminder system
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'notification-dismissed',
                username: data.username,
                zone: data.zone,
                rest_duration: data.rest_duration
            });
        }

        // Start progressive reminders
        this.startProgressiveReminders(data);
    }

    // Progressive reminder system for Chrome
    startProgressiveReminders(data) {
        console.log('Starting Chrome progressive reminders');

        // Store reminder state
        const reminderState = {
            username: data.username,
            zone: data.zone,
            rest_duration: data.rest_duration,
            dismissedAt: Date.now(),
            reminderCount: 0
        };

        localStorage.setItem('chromeReminderState', JSON.stringify(reminderState));

        // First reminder after 5 seconds
        setTimeout(() => {
            this.showProgressiveReminder(reminderState);
            
            // Then every 10 seconds
            const reminderInterval = setInterval(() => {
                const currentState = JSON.parse(localStorage.getItem('chromeReminderState') || '{}');
                if (currentState.username === data.username) {
                    this.showProgressiveReminder(currentState);
                } else {
                    clearInterval(reminderInterval);
                }
            }, 10000);
            
        }, 5000);
    }

    // Show progressive reminder
    showProgressiveReminder(state) {
        state.reminderCount = (state.reminderCount || 0) + 1;
        localStorage.setItem('chromeReminderState', JSON.stringify(state));

        console.log(`Showing Chrome progressive reminder #${state.reminderCount}`);

        const title = `Reminder #${state.reminderCount}: Start Your Rest!`;
        const body = `You dismissed this ${state.reminderCount} time(s). You need to start your rest cycle.`;

        const options = {
            body: body,
            icon: '/static/icon-192.png',
            badge: '/static/icon-192.png',
            tag: `wbgt-reminder-${Date.now()}`,
            requireInteraction: true,
            silent: false,
            vibrate: [500, 200, 500, 200, 500],
            timestamp: Date.now(),
            actions: [
                {
                    action: 'start-rest',
                    title: 'Start Rest Now',
                    icon: '/static/icon-192.png'
                },
                {
                    action: 'dismiss',
                    title: 'Dismiss Again',
                    icon: '/static/icon-192.png'
                }
            ],
            data: {
                username: state.username,
                zone: state.zone,
                rest_duration: state.rest_duration,
                isReminder: true,
                reminderCount: state.reminderCount
            }
        };

        if (this.registration && this.registration.showNotification) {
            this.registration.showNotification(title, options);
        } else {
            new Notification(title, options);
        }

        // Enhanced vibration for reminders
        if ('vibrate' in navigator) {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }
    }

    // Clear all reminders
    clearReminders() {
        console.log('Clearing Chrome notification reminders');
        localStorage.removeItem('chromeReminderState');
        
        // Send message to service worker
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'clear-reminders'
            });
        }
    }

    // Check for pending reminders on page load
    checkPendingReminders() {
        const reminderState = localStorage.getItem('chromeReminderState');
        if (reminderState) {
            try {
                const state = JSON.parse(reminderState);
                if (state.username === this.currentUser) {
                    console.log('Resuming Chrome reminders from previous session');
                    
                    // Resume reminders immediately
                    this.showProgressiveReminder(state);
                    
                    const reminderInterval = setInterval(() => {
                        const currentState = JSON.parse(localStorage.getItem('chromeReminderState') || '{}');
                        if (currentState.username === this.currentUser) {
                            this.showProgressiveReminder(currentState);
                        } else {
                            clearInterval(reminderInterval);
                        }
                    }, 10000);
                }
            } catch (error) {
                console.error('Error resuming Chrome reminders:', error);
                localStorage.removeItem('chromeReminderState');
            }
        }
    }
}

// Global Chrome notification manager
let chromeNotificationManager = null;

// Initialize Chrome notifications
async function initializeChromeNotifications(username) {
    if (!chromeNotificationManager) {
        chromeNotificationManager = new ChromeNotificationManager();
    }
    return await chromeNotificationManager.initialize(username);
}

// Request Chrome notification permission (must be called from user interaction)
async function requestChromeNotificationPermission() {
    console.log('Requesting Chrome notification permission with user interaction');
    
    if (!chromeNotificationManager) {
        chromeNotificationManager = new ChromeNotificationManager();
    }
    
    const permission = await chromeNotificationManager.requestPermission();
    console.log('Permission request result:', permission);
    
    if (permission === 'granted') {
        // Try to register service worker again
        try {
            const registration = await navigator.serviceWorker.register('/static/chrome-sw.js', {
                scope: '/'
            });
            chromeNotificationManager.registration = registration;
            await navigator.serviceWorker.ready;
            console.log('Service worker registered after permission granted');
            return true;
        } catch (error) {
            console.error('Failed to register service worker after permission:', error);
            return false;
        }
    }
    
    return permission === 'granted';
}

// Test Chrome notification (for debugging)
function testChromeNotification() {
    console.log('Testing Chrome notification manually');
    
    if (!chromeNotificationManager) {
        console.error('Chrome notification manager not initialized');
        return;
    }
    
    const testData = {
        title: 'Test Notification',
        message: 'This is a test notification to verify Chrome notifications are working.',
        username: window.currentUser || 'TestUser',
        zone: 'test',
        rest_duration: 10
    };
    
    const result = chromeNotificationManager.showWorkCompleteNotification(testData);
    console.log('Test notification result:', result);
    return result;
}

// Show work complete notification for Chrome
function showChromeWorkCompleteNotification(data) {
    if (chromeNotificationManager) {
        chromeNotificationManager.showWorkCompleteNotification(data);
    }
}

// Clear Chrome reminders
function clearChromeReminders() {
    if (chromeNotificationManager) {
        chromeNotificationManager.clearReminders();
    }
}

// Check pending Chrome reminders
function checkPendingChromeReminders() {
    if (chromeNotificationManager) {
        chromeNotificationManager.checkPendingReminders();
    }
}
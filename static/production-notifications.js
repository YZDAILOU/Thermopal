// Production notification system for Chrome on Render deployment
// This system works independently of service workers and handles page refresh scenarios

class ProductionNotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window;
        this.refreshInterval = null;
        this.lastWorkCompletionCheck = null;
        console.log('Production Notification Manager initialized');
    }

    // Initialize automatic refresh-based notification checking
    initialize(username) {
        console.log('Initializing production notifications for:', username);
        
        if (!this.isSupported) {
            console.log('Notifications not supported in this browser');
            return false;
        }

        // Request permission if not already granted
        this.requestPermission().then(granted => {
            if (granted) {
                console.log('Production notifications permission granted');
                this.startPeriodicCheck(username);
            } else {
                console.log('Production notifications permission denied');
            }
        });

        return true;
    }

    async requestPermission() {
        if (Notification.permission === 'granted') {
            return true;
        }

        if (Notification.permission === 'denied') {
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    // Start periodic checking for work completion (every 5 seconds)
    startPeriodicCheck(username) {
        console.log('Starting periodic work completion check for production notifications');
        
        // Clear any existing interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Check immediately
        this.checkWorkCompletion(username);

        // Then check every 5 seconds
        this.refreshInterval = setInterval(() => {
            this.checkWorkCompletion(username);
        }, 5000);
    }

    checkWorkCompletion(username) {
        fetch(`/get_user_state/${username}`)
            .then(response => response.json())
            .then(data => {
                if (data.work_completed && data.pending_rest) {
                    const workEndTime = new Date(data.end_time).getTime();
                    
                    // Only show notification if this is a new work completion
                    if (this.lastWorkCompletionCheck !== workEndTime) {
                        console.log('New work completion detected via periodic check');
                        this.lastWorkCompletionCheck = workEndTime;
                        this.showWorkCompletionNotification(data);
                    }
                }
            })
            .catch(error => {
                console.error('Error checking work completion:', error);
            });
    }

    showWorkCompletionNotification(data) {
        console.log('Showing production work completion notification:', data);

        if (Notification.permission !== 'granted') {
            console.log('Cannot show notification - permission not granted');
            return;
        }

        const restTime = this.getRestTimeForZone(data.zone);
        const timeUnit = data.zone === 'test' ? 'second' : 'minute';

        try {
            const notification = new Notification('🚨 Work Cycle Complete!', {
                body: `Your ${data.zone?.toUpperCase() || 'WORK'} zone work cycle has ended. Start your ${restTime} ${timeUnit} rest cycle now!`,
                icon: '/static/icon-192.png',
                tag: 'wbgt-production-' + Date.now(),
                requireInteraction: true,
                silent: false
            });

            notification.onclick = () => {
                console.log('Production notification clicked');
                window.focus();
                notification.close();
                
                // Focus on the dashboard if not already there
                if (!window.location.pathname.includes('/dashboard')) {
                    window.location.href = '/dashboard';
                }
            };

            notification.onshow = () => {
                console.log('Production notification shown successfully');
            };

            notification.onerror = (error) => {
                console.error('Production notification error:', error);
            };

            // Auto-close after 30 seconds and show reminder
            setTimeout(() => {
                if (notification) {
                    notification.close();
                    this.showReminderNotification(data, restTime, timeUnit);
                }
            }, 30000);

        } catch (error) {
            console.error('Failed to show production notification:', error);
        }
    }

    showReminderNotification(data, restTime, timeUnit) {
        console.log('Showing reminder notification');

        if (Notification.permission !== 'granted') {
            return;
        }

        try {
            const reminderNotification = new Notification('⚠️ Rest Reminder', {
                body: `You still need to start your ${restTime} ${timeUnit} rest cycle. Don't forget!`,
                icon: '/static/icon-192.png',
                tag: 'wbgt-reminder-' + Date.now(),
                requireInteraction: true,
                silent: false
            });

            reminderNotification.onclick = () => {
                window.focus();
                reminderNotification.close();
            };

        } catch (error) {
            console.error('Failed to show reminder notification:', error);
        }
    }

    getRestTimeForZone(zone) {
        const restTimes = {
            'white': 15,
            'green': 15,
            'yellow': 15,
            'red': 30,
            'black': 30,
            'test': 10
        };
        return restTimes[zone] || 15;
    }

    // Stop periodic checking
    stop() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        console.log('Production notification checking stopped');
    }

    // Show immediate test notification
    test() {
        console.log('Testing production notification');
        
        if (Notification.permission !== 'granted') {
            console.log('Cannot test - permission not granted');
            return false;
        }

        try {
            const testNotification = new Notification('Test Notification', {
                body: 'Production notification system is working correctly!',
                icon: '/static/icon-192.png',
                tag: 'wbgt-test-notification',
                requireInteraction: true
            });

            testNotification.onclick = () => {
                window.focus();
                testNotification.close();
            };

            console.log('Test notification shown');
            return true;
        } catch (error) {
            console.error('Test notification failed:', error);
            return false;
        }
    }
}

// Global production notification manager
let productionNotificationManager = null;

// Initialize production notifications
function initializeProductionNotifications(username) {
    console.log('Initializing production notification system');
    
    if (!productionNotificationManager) {
        productionNotificationManager = new ProductionNotificationManager();
    }
    
    return productionNotificationManager.initialize(username);
}

// Test production notification
function testProductionNotification() {
    if (productionNotificationManager) {
        return productionNotificationManager.test();
    }
    console.error('Production notification manager not initialized');
    return false;
}

// Stop production notifications
function stopProductionNotifications() {
    if (productionNotificationManager) {
        productionNotificationManager.stop();
    }
}
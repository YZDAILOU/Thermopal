// Firebase push notifications integration
let messaging = null;
let currentUser = null;
let isMobileDevice = false;
let firebaseAudioInitialized = false;

// Detect mobile browser
function detectMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    return isMobileDevice;
}

// Initialize Firebase audio context after user interaction
function initializeFirebaseAudio() {
    if (!firebaseAudioInitialized && !firebaseAudioContext) {
        try {
            firebaseAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            firebaseAudioInitialized = true;
            console.log('Firebase audio context initialized for mobile');
        } catch (e) {
            console.log('Could not initialize Firebase audio context:', e);
        }
    }
}

// Initialize Firebase notifications
async function initializeFirebaseNotifications(username) {
    currentUser = username;

    try {
        // Import Firebase modules
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getMessaging, getToken, onMessage } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js');

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
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        // Register service worker with enhanced scope for better background support
        if ('serviceWorker' in navigator) {
            try {
                // Register Firebase messaging service worker with root scope for better coverage
                const registration = await navigator.serviceWorker.register('/static/firebase-messaging-sw.js', {
                    scope: '/'
                });

                // Wait for service worker to be ready
                await navigator.serviceWorker.ready;
                console.log('Firebase Service Worker registered and ready:', registration);

                // Also register the general service worker for push notifications
                await navigator.serviceWorker.register('/static/sw.js', {
                    scope: '/'
                });
                console.log('General Service Worker registered');

                // Enhanced service worker message handling
                navigator.serviceWorker.addEventListener('message', event => {
                    console.log('Received message from service worker:', event.data);
                    if (event.data && event.data.type === 'notification-click') {
                        console.log('Notification was clicked');
                        // Handle notification click actions
                        if (event.data.action === 'start-rest') {
                            handleStartRestAction();
                        }
                    }
                });

                // Listen for service worker updates
                registration.addEventListener('updatefound', () => {
                    console.log('Service worker update found');
                });

            } catch (error) {
                console.log('Service Worker registration failed:', error);
            }
        }

        // Request notification permission with better mobile handling
        let permission = Notification.permission;

        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
            console.log('Notification permission granted for mobile device');

            // Get FCM registration token with service worker registration
            try {
                    const token = await getToken(messaging, {
                        vapidKey: 'BLch2zbnpXdzzV_OYtZicTjbefAURKoUyBtL8blEMcTciTYLMeGrGEorwMsSrRyGZ14vmH6mqAluZ87IaITT-3U',
                        serviceWorkerRegistration: registration
                    });

                if (token) {
                    console.log('FCM Registration token for mobile:', token);

                    // Send token to server
                    await fetch('/save-fcm-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            token: token, 
                            username: username 
                        })
                    });

                    console.log('FCM token saved to server for mobile device');

                    // Set up foreground message handling
                    onMessage(messaging, (payload) => {
                        console.log('Foreground message received on mobile:', payload);

                        // Create notification even when app is in foreground
                        if (payload.notification) {
                            // Show browser notification
                            const notification = new Notification(payload.notification.title, {
                                body: payload.notification.body,
                                icon: '/static/icon.png',
                                badge: '/static/icon.png',
                                tag: 'wbgt-notification',
                                requireInteraction: true,
                                vibrate: [500, 300, 500, 300, 500],
                                silent: false
                            });

                            // Handle notification click
                            notification.onclick = function() {
                                window.focus();
                                notification.close();
                            };

                            // Also trigger in-app notification
                            handleFirebaseNotificationEvent({
                                username: currentUser,
                                title: payload.notification.title,
                                body: payload.notification.body
                            });
                        }
                    });

                    return true;
                } else {
                    console.log('No registration token available for mobile.');
                    return false;
                }
            } catch (err) {
                console.log('An error occurred while retrieving mobile token:', err);
                return false;
            }
        } else {
            console.log('Unable to get notification permission on mobile.');
            return false;
        }

    } catch (error) {
        console.log('Error initializing Firebase notifications on mobile:', error);
        return false;
    }
}

// Handle foreground messages
function handleForegroundMessages() {
    if (!messaging) return;

    const { onMessage } = firebase.messaging;

    onMessage(messaging, (payload) => {
        console.log('Message received in foreground:', payload);

        // Show notification even when app is open
        if (payload.notification) {
            // Create a more prominent notification
            new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: '/generated-icon.png',
                badge: '/generated-icon.png',
                tag: 'work-cycle-notification',
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200]
            });

            // Also show an in-app alert
            showInAppNotification(payload.notification.title, payload.notification.body);
        }
    });
}

// Show Firebase work complete notification manually
function showFirebaseWorkCompleteNotification(data) {
    console.log('Showing Firebase work complete notification for:', data.username);
    
    // Create a browser notification if permission granted
    if (Notification.permission === 'granted') {
        const notification = new Notification('Work Cycle Complete!', {
            body: `Your work cycle has ended. Time to start your rest cycle!`,
            icon: '/static/icon-192.png',
            badge: '/static/icon-192.png',
            tag: 'wbgt-notification',
            requireInteraction: true,
            vibrate: [500, 300, 500, 300, 500],
            silent: false
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
    
    // Also show in-app notification
    showInAppNotification('Work Cycle Complete!', 'Your work cycle has ended. Time to start your rest cycle!');
    
    // Trigger the work modal if available
    if (typeof workModal !== 'undefined') {
        workModal.showWorkCompletionModal(data);
    }
}

// Show in-app notification
function showInAppNotification(title, body) {
    // Create a prominent in-app notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
        <div class="flex items-center">
            <div class="flex-1">
                <h4 class="font-bold">${title}</h4>
                <p class="text-sm">${body}</p>
            </div>
            <button class="ml-2 text-white hover:text-gray-300" onclick="stopAllFirebaseSounds(); this.parentElement.parentElement.remove();">
                ✕
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 10000);
}

// Handle Firebase notification events from server
function handleFirebaseNotificationEvent(data) {
    if (data.username === currentUser && data.title && data.body) {
        console.log('Received Firebase notification for current user:', data);

        // Show notification with Start/Dismiss actions
        showRestCycleNotification(data.title, data.body, data.actions);

        // Extract zone from notification body to get correct rest duration
        const zoneMatch = data.body.match(/Your (\w+) zone/i);
        const zone = zoneMatch ? zoneMatch[1].toLowerCase() : 'unknown';
        const restMinutes = getRestMinutesForZone(zone);

        // Start reminder system that will activate after 10 seconds if user doesn't start rest
        if (typeof startRestReminderSystem === 'function') {
            startRestReminderSystem(zone, restMinutes);
        }
    }
}

// Global variables for Firebase sound management
let firebaseAudioContext = null;
let firebaseActiveOscillators = [];

// Function to stop all Firebase sounds
function stopAllFirebaseSounds() {
    // Stop all active oscillators
    firebaseActiveOscillators.forEach(oscillator => {
        try {
            oscillator.stop();
        } catch (e) {
            // Oscillator may already be stopped
        }
    });
    firebaseActiveOscillators = [];

    // Close current audio context if it exists
    if (firebaseAudioContext && firebaseAudioContext.state !== 'closed') {
        try {
            firebaseAudioContext.close();
        } catch (e) {
            // Context may already be closed
        }
    }
    firebaseAudioContext = null;

    console.log('All Firebase sounds stopped');
}

// Show rest cycle notification with action buttons
function showRestCycleNotification(title, body, actions) {
    // Create prominent notification overlay with action buttons
    const notificationOverlay = document.createElement('div');
    notificationOverlay.id = 'firebase-notification-overlay';
    notificationOverlay.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    notificationOverlay.innerHTML = `
        <div class="bg-white p-8 rounded-lg shadow-xl max-w-md mx-4 text-center">
            <div class="text-6xl mb-4">⏰</div>
            <h3 class="text-2xl font-bold mb-4 text-red-600">${title}</h3>
            <p class="text-gray-700 mb-8 text-lg">${body}</p>
            <div class="flex space-x-4 justify-center">
                <button id="start-rest-btn" class="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-lg">
                    Start Rest
                </button>
                <button id="dismiss-notification-btn" class="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 font-bold text-lg">
                    Dismiss
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(notificationOverlay);

    // Add event listeners for action buttons
    document.getElementById('start-rest-btn').addEventListener('click', function() {
        stopAllFirebaseSounds();
        handleStartRestAction();
        notificationOverlay.remove();
    });

    document.getElementById('dismiss-notification-btn').addEventListener('click', function() {
        // Stop sounds immediately
        stopAllFirebaseSounds();

        // Remove the notification overlay
        notificationOverlay.remove();

        // Send dismiss message to service worker for progressive reminder system
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'notification-dismissed',
                username: currentUser,
                zone: zone || 'unknown'
            });
        }

        // Disable WBGT zones immediately when dismissed
        if (typeof disableZoneButtons === 'function') {
            disableZoneButtons();
        }

        // Extract zone from notification body to restart reminder system
        const zoneMatch = body.match(/Your (\w+) zone/i);
        const zone = zoneMatch ? zoneMatch[1].toLowerCase() : 'unknown';
        const restMinutes = getRestMinutesForZone(zone);

        // Start the reminder system (will remind again after 12 seconds)
        startFirebaseReminderSystem(title, body);
    });

    // Add vibration pattern for mobile devices
    if ('vibrate' in navigator) {
        navigator.vibrate([500, 300, 500, 300, 500, 300, 800]);
    }

    // Don't play alert sound here - let work-notifications.js handle it to avoid duplicates
}

// Handle start rest action
function handleStartRestAction() {
    console.log('User clicked Start Rest button');

    // Clear all Firebase reminders and sounds
    clearFirebaseReminders();
    stopAllFirebaseSounds();

    // Re-enable zone buttons immediately
    if (typeof enableZoneButtons === 'function') {
        enableZoneButtons();
    }

    // Make request to start rest cycle
    fetch('/start_rest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            username: currentUser
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('Rest cycle started successfully');

            // Update the dashboard immediately
            if (typeof updateDashboard === 'function') {
                updateDashboard();
            }

            // Call the dashboard function if available
            if (typeof startRestCycleFromNotification === 'function') {
                startRestCycleFromNotification();
            }
        } else {
            console.error('Failed to start rest cycle:', data.error);
            alert('Failed to start rest cycle: ' + (data.error || 'Unknown error'));
        }
    })
    .catch(error => {
        console.error('Error starting rest cycle:', error);
        alert('Error starting rest cycle. Please try again.');
    });
}

let firebaseReminderInterval = null;

// Start reminder system that repeats every 10 seconds
function startFirebaseReminderSystem(title, body) {
    // Clear any existing reminders
    clearFirebaseReminders();

    console.log('Starting Firebase reminder system - will remind in 12 seconds, then every 10 seconds');

    // Start reminders after 12 seconds if rest cycle hasn't started
    setTimeout(() => {
        console.log('Starting Firebase reminders - 12 seconds have passed');

        // Show initial reminder
        showFirebaseReminder(title, body);

        // Set up interval to show reminder every 10 seconds - this will continue indefinitely until cleared
        firebaseReminderInterval = setInterval(() => {
            console.log('Showing Firebase reminder every 10 seconds');
            showFirebaseReminder(title, body);
        }, 10000); // 10 seconds

    }, 12000); // 12 seconds
}

// Show Firebase reminder notification
function showFirebaseReminder(title, body) {
    console.log('Showing Firebase reminder notification');

    // Remove any existing reminder
    const existingReminder = document.getElementById('firebase-reminder-banner');
    if (existingReminder) {
        existingReminder.remove();
    }

    // Disable zone buttons during reminder
    if (typeof disableZoneButtons === 'function') {
        disableZoneButtons();
    }

    // Create reminder banner
    const reminderBanner = document.createElement('div');
    reminderBanner.id = 'firebase-reminder-banner';
    reminderBanner.className = 'fixed inset-x-4 top-4 bg-red-600 text-white p-6 rounded-lg shadow-2xl z-50 border-4 border-red-800 animate-pulse';
    reminderBanner.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <div class="text-3xl mr-4 animate-bounce">🚨</div>
                <div>
                    <h4 class="font-bold text-xl">${title}</h4>
                    <p class="text-lg mt-2">${body}</p>
                </div>
            </div>
            <div class="flex space-x-2 ml-4">
                <button id="reminder-start-rest" class="bg-green-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-600">
                    Start Rest
                </button>
                <button id="reminder-dismiss" class="bg-gray-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-600">
                    Dismiss
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(reminderBanner);

    // Add event listeners
    document.getElementById('reminder-start-rest').addEventListener('click', function() {
        stopAllFirebaseSounds();
        handleStartRestAction();
        reminderBanner.remove();
    });

    document.getElementById('reminder-dismiss').addEventListener('click', function() {
        // Stop sounds immediately
        stopAllFirebaseSounds();

        // Remove the current banner
        reminderBanner.remove();

        // Keep zones disabled - user must start rest to re-enable them
        if (typeof disableZoneButtons === 'function') {
            disableZoneButtons();
        }

        // Keep the reminder interval running - it will show another reminder in 10 seconds
        console.log('Firebase banner dismissed - reminder system continues running, will show again in 10 seconds');
    });

    // REMOVED: Auto-remove timeout - banner persists until user action

    // Enhanced vibration for mobile
    if ('vibrate' in navigator) {
        navigator.vibrate([800, 300, 800, 300, 800, 300, 1000]);
    }

    // Play enhanced reminder sound with multiple attempts
    playFirebaseReminderSound();

    // Try to play system notification sound as backup
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLPfCsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjiM1fLNeSgGJXjH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBjOJ1fLOeSsFJHfH8N2QQAo=');
        audio.volume = 1.0;
        audio.play().catch(e => console.log('Backup audio failed:', e));
    } catch (e) {
        console.log('Could not play backup audio:', e);
    }
}

// Clear Firebase reminders
function clearFirebaseReminders() {
    if (firebaseReminderInterval) {
        clearInterval(firebaseReminderInterval);
        firebaseReminderInterval = null;
        console.log('Firebase reminders cleared');
    }

    // Remove any existing reminder banner
    const reminderBanner = document.getElementById('firebase-reminder-banner');
    if (reminderBanner) {
        reminderBanner.remove();
    }

    // Stop all Firebase sounds immediately
    stopAllFirebaseSounds();

    // Re-enable zone buttons
    if (typeof enableZoneButtons === 'function') {
        enableZoneButtons();
    }
}

// Play Firebase alert sound
function playFirebaseAlertSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        function createFirebaseBeep(startTime, frequency, duration) {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.5, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);
        }

        const now = audioContext.currentTime;
        createFirebaseBeep(now, 900, 0.8);
        createFirebaseBeep(now + 1.0, 700, 0.8);
        createFirebaseBeep(now + 2.0, 900, 1.0);
        createFirebaseBeep(now + 3.2, 1000, 1.2);

    } catch (e) {
        console.log('Could not play Firebase alert sound:', e);
    }
}

// Play Firebase reminder sound
function playFirebaseReminderSound() {
    try {
        // Stop any existing Firebase sounds first
        stopAllFirebaseSounds();

        firebaseAudioContext = new (window.AudioContext || window.webkitAudioContext)();

        function createReminderBeep(startTime, frequency, duration) {
            const oscillator = firebaseAudioContext.createOscillator();
            const gainNode = firebaseAudioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(firebaseAudioContext.destination);

            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.6, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

            oscillator.start(startTime);
            oscillator.stop(startTime + duration);

            // Track oscillator for potential early stopping
            firebaseActiveOscillators.push(oscillator);

            // Remove from tracking when it naturally ends
            oscillator.addEventListener('ended', () => {
                const index = firebaseActiveOscillators.indexOf(oscillator);
                if (index > -1) {
                    firebaseActiveOscillators.splice(index, 1);
                }
            });
        }

        const now = firebaseAudioContext.currentTime;
        createReminderBeep(now, 1000, 0.8);
        createReminderBeep(now + 1.0, 800, 0.8);
        createReminderBeep(now + 2.0, 1200, 1.0);

    } catch (e) {
        console.log('Could not play Firebase reminder sound:', e);
    }
}

// Make clearFirebaseReminders available globally
window.clearFirebaseReminders = clearFirebaseReminders;

// Check for pending work completion state when page loads
function checkPendingWorkCompletion() {
    if (!currentUser) return;

    // Make a request to check current user state
    fetch(`/get_user_state/${currentUser}`)
        .then(response => response.json())
        .then(data => {
            console.log('Firebase checking pending work completion:', data);
            
            if (data.work_completed && data.pending_rest && data.zone) {
                console.log('Found pending work completion - showing notification banner');

                // Show the notification banner immediately
                const title = "Work Cycle Complete!";
                const restMinutes = getRestMinutesForZone(data.zone);
                let body = `Your work cycle has ended. Time to start rest cycle!`;

                // Show the notification immediately with maximum visibility
                showRestCycleNotification(title, body);

                // Disable zone buttons immediately
                if (typeof disableZoneButtons === 'function') {
                    disableZoneButtons();
                }

                // Start the reminder system
                startFirebaseReminderSystem(title, body);

                // Enhanced feedback for returning users
                if ('vibrate' in navigator) {
                    navigator.vibrate([1000, 300, 1000, 300, 1000, 300, 1500]);
                }
                playFirebaseAlertSound();
            }
        })
        .catch(error => {
            console.log('Error checking pending work completion:', error);
        });
}

// Initialize notifications when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Detect mobile device
    detectMobileDevice();
    console.log('Mobile device detected for Firebase:', isMobileDevice);

    // Initialize audio context on first user interaction for mobile
    if (isMobileDevice) {
        const initFirebaseAudioOnTouch = () => {
            initializeFirebaseAudio();
            document.removeEventListener('touchstart', initFirebaseAudioOnTouch);
            document.removeEventListener('click', initFirebaseAudioOnTouch);
        };

        document.addEventListener('touchstart', initFirebaseAudioOnTouch);
        document.addEventListener('click', initFirebaseAudioOnTouch);
    }

    // Only initialize if we have a current user
    if (typeof currentUser !== 'undefined' && currentUser) {
        initializeFirebaseNotifications(currentUser);

        // Check for pending work completion after a short delay to ensure page is fully loaded
        setTimeout(() => {
            checkPendingWorkCompletion();
        }, 1000);
    }
});
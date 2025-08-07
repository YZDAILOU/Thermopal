// Enhanced Universal WBGT Notification System
// Works for all zones and persists across page navigation
// Supports background notifications via Service Worker

class EnhancedNotificationManager {
    constructor() {
        this.username = null;
        this.serviceWorker = null;
        this.isSupported = 'serviceWorker' in navigator && 'Notification' in window;
        this.lastCheckTime = 0;
        this.pageVisibilityInitialized = false;
        this.currentUserState = null;
        
        console.log('[Notifications] Enhanced notification manager initialized');
        console.log('[Notifications] Service Worker supported:', 'serviceWorker' in navigator);
        console.log('[Notifications] Notifications supported:', 'Notification' in window);
    }

    // Initialize the notification system
    async initialize(username) {
        this.username = username;
        console.log('[Notifications] Initializing enhanced notifications for:', username);

        if (!this.isSupported) {
            console.warn('[Notifications] Enhanced notifications not supported');
            return false;
        }

        try {
            // Register service worker
            await this.registerServiceWorker();
            
            // Request notification permission
            await this.requestPermission();
            
            // Set up page visibility API
            this.setupPageVisibilityAPI();
            
            // Set up service worker messaging
            this.setupServiceWorkerMessaging();
            
            // Start monitoring
            await this.startMonitoring();
            
            // Perform immediate check for missed notifications
            await this.checkForMissedNotifications();
            
            console.log('[Notifications] Enhanced notification system fully initialized');
            return true;
            
        } catch (error) {
            console.error('[Notifications] Failed to initialize enhanced notifications:', error);
            return false;
        }
    }

    // Register service worker
    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/static/sw.js', {
                scope: '/'
            });
            
            console.log('[Notifications] Service worker registered:', registration);
            
            // Wait for service worker to be ready
            await navigator.serviceWorker.ready;
            this.serviceWorker = registration;
            
            return registration;
            
        } catch (error) {
            console.error('[Notifications] Service worker registration failed:', error);
            throw error;
        }
    }

    // Request notification permission
    async requestPermission() {
        if (Notification.permission === 'granted') {
            console.log('[Notifications] Permission already granted');
            return true;
        }

        if (Notification.permission === 'denied') {
            console.warn('[Notifications] Notification permission denied');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            const granted = permission === 'granted';
            
            console.log('[Notifications] Permission request result:', permission);
            return granted;
            
        } catch (error) {
            console.error('[Notifications] Permission request failed:', error);
            return false;
        }
    }

    // Set up page visibility API for better notification handling
    setupPageVisibilityAPI() {
        if (this.pageVisibilityInitialized) {
            return;
        }

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                console.log('[Notifications] Page became visible - checking for missed notifications');
                this.checkForMissedNotifications(false);
            } else {
                console.log('[Notifications] Page became hidden - background monitoring active');
            }
        });

        // Handle page focus/blur
        window.addEventListener('focus', () => {
            console.log('[Notifications] Window focused - checking for missed notifications');
            this.checkForMissedNotifications(false);
        });

        // Handle page load/unload
        window.addEventListener('load', () => {
            console.log('[Notifications] Page loaded - checking for missed notifications');
            setTimeout(() => this.checkForMissedNotifications(false), 1000);
        });

        window.addEventListener('beforeunload', () => {
            console.log('[Notifications] Page unloading - ensuring background monitoring');
        });

        this.pageVisibilityInitialized = true;
        console.log('[Notifications] Page visibility API initialized');
    }

    // Set up service worker messaging
    setupServiceWorkerMessaging() {
        if (!navigator.serviceWorker) {
            return;
        }

        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('[Notifications] Message from service worker:', event.data);
            
            const { type, data } = event.data;
            
            switch (type) {
                case 'WORK_COMPLETION_DETECTED':
                    this.handleWorkCompletionFromSW(data);
                    break;
                case 'START_REST_FROM_NOTIFICATION':
                    this.handleStartRestFromNotification(data);
                    break;
            }
        });

        console.log('[Notifications] Service worker messaging initialized');
    }

    // Start monitoring via service worker
    async startMonitoring() {
        if (!this.serviceWorker || !this.username) {
            console.warn('[Notifications] Cannot start monitoring - missing service worker or username');
            return;
        }

        try {
            // Send message to service worker to start monitoring
            await this.sendMessageToSW('START_MONITORING', { username: this.username });
            console.log('[Notifications] Started background monitoring for:', this.username);
            
        } catch (error) {
            console.error('[Notifications] Failed to start monitoring:', error);
        }
    }

    // Stop monitoring
    async stopMonitoring() {
        if (!this.serviceWorker || !this.username) {
            return;
        }

        try {
            await this.sendMessageToSW('STOP_MONITORING', { username: this.username });
            console.log('[Notifications] Stopped background monitoring for:', this.username);
            
        } catch (error) {
            console.error('[Notifications] Failed to stop monitoring:', error);
        }
    }

    // Send message to service worker
    async sendMessageToSW(type, data) {
        if (!navigator.serviceWorker.controller) {
            console.warn('[Notifications] No service worker controller available');
            return;
        }

        navigator.serviceWorker.controller.postMessage({
            type: type,
            data: data
        });
    }

    // Check for missed notifications (called when page becomes visible)
    async checkForMissedNotifications(showNoNotificationMessage = false) {
        if (!this.username) {
            return;
        }

        try {
            console.log('[Notifications] Checking for missed notifications...');
            
            const response = await fetch(`/get_user_state/${this.username}`);
            const userData = await response.json();
            
            console.log('[Notifications] Current user state:', userData);
            
            // Check if there's a pending work completion
            if (userData.work_completed && userData.pending_rest && userData.zone) {
                console.log('[Notifications] Found missed work completion - showing notification');
                await this.showImmediateNotification(userData);
                return true; // Found notifications
            } else {
                console.log('[Notifications] No missed notifications found');
                if (showNoNotificationMessage) {
                    this.showNoNotificationMessage();
                }
                return false; // No notifications found
            }
            
            this.currentUserState = userData;
            
        } catch (error) {
            console.error('[Notifications] Error checking for missed notifications:', error);
            if (showNoNotificationMessage) {
                alert('Error checking for notifications. Please try again.');
            }
            return false;
        }
    }

    // Show message when no notifications are found (for manual refresh)
    showNoNotificationMessage() {
        // Create or update no notification message
        let modal = document.getElementById('no-notification-modal');
        if (!modal) {
            modal = this.createNoNotificationModal();
        }

        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Auto-hide after 3 seconds
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 3000);

        console.log('[Notifications] No notification message shown');
    }

    // Create no notification modal
    createNoNotificationModal() {
        const modalHTML = `
            <div id="no-notification-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl border-2 border-green-500">
                    <div class="text-center">
                        <div class="text-4xl mb-4">✅</div>
                        <h3 class="text-xl font-bold text-green-600 mb-4">All Clear!</h3>
                        <p class="text-gray-700 mb-4">No work completion notifications at this time.</p>
                        <button onclick="document.getElementById('no-notification-modal').classList.add('hidden'); document.getElementById('no-notification-modal').style.display = 'none';" 
                            class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-all duration-200">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        return document.getElementById('no-notification-modal');
    }

    // Show immediate notification for missed work completion
    async showImmediateNotification(userData) {
        const restTime = this.getRestTimeForZone(userData.zone);
        const timeUnit = userData.zone === 'test' ? 'second' : 'minute';
        
        console.log('[Notifications] Showing immediate notification for zone:', userData.zone);
        
        // Show browser notification if supported
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification(`🚨 Work Complete - ${userData.zone.toUpperCase()} Zone`, {
                    body: `Your ${userData.zone.toUpperCase()} work cycle has ended. Start your ${restTime} ${timeUnit} rest cycle now!`,
                    icon: '/static/icon-192.png',
                    tag: `missed-work-complete-${userData.zone}`,
                    requireInteraction: true,
                    vibrate: [200, 100, 200, 100, 200]
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                    this.focusRestButton(userData.zone);
                };

                console.log('[Notifications] Browser notification shown for missed completion');
                
            } catch (error) {
                console.error('[Notifications] Failed to show browser notification:', error);
            }
        }
        
        // Show modal notification
        this.showModalNotification(userData, restTime, timeUnit);
        
        // Play audio alert
        this.playAudioAlert();
        
        // Trigger vibration if supported
        this.triggerVibration();
        
        // Focus rest button or show UI indicator
        this.focusRestButton(userData.zone);
    }

    // Handle work completion detected by service worker
    handleWorkCompletionFromSW(data) {
        console.log('[Notifications] Work completion detected by service worker:', data);
        
        // Show modal and visual indicators even if page is active
        this.showModalNotification({
            zone: data.zone,
            work_completed: true,
            pending_rest: true
        }, data.restTime, data.timeUnit);
        
        this.playAudioAlert();
        this.triggerVibration();
        this.focusRestButton(data.zone);
    }

    // Handle start rest from notification click
    handleStartRestFromNotification(data) {
        console.log('[Notifications] Starting rest from notification click:', data);
        
        // Trigger rest start if possible
        if (typeof window.startRest === 'function') {
            window.startRest(data.zone);
        } else {
            // Focus the rest button for the zone
            this.focusRestButton(data.zone);
        }
    }

    // Show modal notification
    showModalNotification(userData, restTime, timeUnit) {
        // Create or update modal
        let modal = document.getElementById('enhanced-notification-modal');
        if (!modal) {
            modal = this.createNotificationModal();
        }

        // Update modal content
        document.getElementById('enhanced-modal-title').textContent = `🚨 Work Complete - ${userData.zone.toUpperCase()} Zone`;
        document.getElementById('enhanced-modal-message').textContent = 
            `Your ${userData.zone.toUpperCase()} work cycle has ended. You must start your ${restTime} ${timeUnit} rest cycle now!`;

        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Set up event listeners
        this.setupModalEventListeners(userData);

        console.log('[Notifications] Modal notification shown for zone:', userData.zone);
    }

    // Create notification modal
    createNotificationModal() {
        const modalHTML = `
            <div id="enhanced-notification-modal" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 hidden">
                <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-2xl border-4 border-red-500 animate-pulse">
                    <div class="text-center">
                        <div class="text-4xl mb-4">🚨</div>
                        <h3 id="enhanced-modal-title" class="text-xl font-bold text-red-600 mb-4"></h3>
                        <p id="enhanced-modal-message" class="text-gray-700 mb-6 font-medium"></p>
                        <div class="flex flex-col gap-3">
                            <button id="enhanced-start-rest" class="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition-all duration-200 shadow-lg">
                                Start Rest Cycle
                            </button>
                            <button id="enhanced-dismiss" class="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-all duration-200">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        return document.getElementById('enhanced-notification-modal');
    }

    // Set up modal event listeners
    setupModalEventListeners(userData) {
        const startButton = document.getElementById('enhanced-start-rest');
        const dismissButton = document.getElementById('enhanced-dismiss');
        const modal = document.getElementById('enhanced-notification-modal');

        // Remove existing listeners
        const newStartButton = startButton.cloneNode(true);
        const newDismissButton = dismissButton.cloneNode(true);
        startButton.parentNode.replaceChild(newStartButton, startButton);
        dismissButton.parentNode.replaceChild(newDismissButton, dismissButton);

        // Add new listeners
        newStartButton.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            
            // Try to start rest automatically
            if (typeof window.startRest === 'function') {
                window.startRest(userData.zone);
            } else {
                this.focusRestButton(userData.zone);
            }
            
            this.markAsNotified();
        });

        newDismissButton.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
            this.markAsNotified();
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
                this.markAsNotified();
            }
        });
    }

    // Focus rest button for the specific zone
    focusRestButton(zone) {
        // Try to find and focus the rest button
        const restButton = document.querySelector(`button[onclick*="startRest('${zone}')"]`) ||
                          document.querySelector(`button[onclick*='startRest("${zone}")']`) ||
                          document.querySelector('#start-rest-button') ||
                          document.querySelector('.rest-button');
        
        if (restButton) {
            restButton.focus();
            restButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add visual highlight
            restButton.style.animation = 'pulse 2s infinite';
            setTimeout(() => {
                restButton.style.animation = '';
            }, 10000);
            
            console.log('[Notifications] Focused rest button for zone:', zone);
        } else {
            console.log('[Notifications] Rest button not found for zone:', zone);
        }
    }

    // Play audio alert
    playAudioAlert() {
        try {
            // Create audio context for better mobile support
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create beep sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
            console.log('[Notifications] Audio alert played');
            
        } catch (error) {
            console.log('[Notifications] Audio alert failed:', error);
        }
    }

    // Trigger vibration
    triggerVibration() {
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
            console.log('[Notifications] Vibration triggered');
        }
    }

    // Get rest time for zone
    getRestTimeForZone(zone) {
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
    markAsNotified() {
        if (this.serviceWorker && this.username) {
            this.sendMessageToSW('MARK_NOTIFIED', { username: this.username });
            console.log('[Notifications] Marked user as notified');
        }
    }

    // Cleanup when leaving page
    cleanup() {
        console.log('[Notifications] Cleaning up notification manager');
        this.stopMonitoring();
    }
}

// Global instance
window.enhancedNotificationManager = new EnhancedNotificationManager();


// Auto-cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.enhancedNotificationManager) {
        window.enhancedNotificationManager.cleanup();
    }
});

console.log('[Notifications] Enhanced notification system loaded with refresh button support');
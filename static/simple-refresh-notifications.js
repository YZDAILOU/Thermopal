// Simple Refresh-Based Notification System
// ONLY notification system that works reliably on Chrome and iOS Safari on Render platform
// No automatic popups - only works when user clicks refresh button

class SimpleRefreshNotifications {
    constructor() {
        this.hasShownNotification = false;
        this.isProcessing = false;
        console.log('Simple refresh notification system initialized');
    }

    // Main function called when user clicks refresh button
    async checkAndShowNotifications(username) {
        if (this.isProcessing) {
            console.log('Already processing notification check');
            return;
        }

        this.isProcessing = true;
        console.log('Checking for work completion notifications for:', username);

        try {
            const response = await fetch(`/get_user_state/${username}`);
            const userData = await response.json();
            
            console.log('User state retrieved:', userData);

            // Check if user has completed work and needs rest
            if (userData.work_completed && userData.pending_rest && userData.zone) {
                console.log('Work completion detected - showing notification');
                this.showWorkCompletionNotification(userData, username);
            } else {
                console.log('No work completion notifications needed');
                this.showNoNotificationMessage();
            }
        } catch (error) {
            console.error('Error checking user state:', error);
            alert('Error checking for notifications. Please try again.');
        } finally {
            this.isProcessing = false;
        }
    }

    showWorkCompletionNotification(userData, username) {
        const restTime = this.getRestTimeForZone(userData.zone);
        const timeUnit = userData.zone === 'test' ? 'second' : 'minute';
        
        console.log('Showing work completion notification for zone:', userData.zone);

        // Show multiple notification methods for maximum reliability
        this.showBrowserNotification(userData, restTime, timeUnit);
        this.showModalNotification(userData, restTime, timeUnit, username);
        this.showVisualAlert(userData, restTime, timeUnit);
        this.playAudioAlert();
        this.triggerVibration();

        this.hasShownNotification = true;
    }

    showBrowserNotification(userData, restTime, timeUnit) {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                try {
                    const notification = new Notification('🚨 Work Cycle Complete!', {
                        body: `Your ${userData.zone.toUpperCase()} work cycle ended. Start your ${restTime} ${timeUnit} rest now!`,
                        icon: '/static/icon-192.png',
                        requireInteraction: true,
                        tag: 'work-complete',
                        silent: false
                    });

                    notification.onclick = () => {
                        window.focus();
                        notification.close();
                    };

                    console.log('Browser notification shown');
                } catch (error) {
                    console.log('Browser notification failed:', error);
                }
            } else if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        this.showBrowserNotification(userData, restTime, timeUnit);
                    }
                });
            }
        }
    }

    showModalNotification(userData, restTime, timeUnit, username) {
        // Create or update the modal
        let modal = document.getElementById('refresh-notification-modal');
        if (!modal) {
            modal = this.createNotificationModal();
        }

        // Update modal content
        document.getElementById('refresh-modal-title').textContent = '🚨 Work Cycle Complete!';
        document.getElementById('refresh-modal-message').textContent = 
            `Your ${userData.zone.toUpperCase()} work cycle has ended. You must start your ${restTime} ${timeUnit} rest cycle now!`;

        // Show modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Set up event listeners
        this.setupModalEventListeners(userData, username);

        console.log('Modal notification shown');
    }

    createNotificationModal() {
        const modalHTML = `
            <div id="refresh-notification-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden">
                <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl border-4 border-red-500">
                    <div class="text-center">
                        <div class="text-4xl mb-4">🚨</div>
                        <h3 id="refresh-modal-title" class="text-xl font-bold text-red-600 mb-4"></h3>
                        <p id="refresh-modal-message" class="text-gray-700 mb-6"></p>
                        <div class="flex flex-col gap-3">
                            <button id="refresh-start-rest" class="bg-green-600 text-white px-6 py-3 rounded font-bold hover:bg-green-700 transition">
                                Start Rest Cycle
                            </button>
                            <button id="refresh-dismiss" class="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition">
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        return document.getElementById('refresh-notification-modal');
    }

    setupModalEventListeners(userData, username) {
        const startRestBtn = document.getElementById('refresh-start-rest');
        const dismissBtn = document.getElementById('refresh-dismiss');

        // Remove existing listeners
        startRestBtn.replaceWith(startRestBtn.cloneNode(true));
        dismissBtn.replaceWith(dismissBtn.cloneNode(true));

        // Add new listeners
        document.getElementById('refresh-start-rest').addEventListener('click', () => {
            this.startRestCycle(username);
        });

        document.getElementById('refresh-dismiss').addEventListener('click', () => {
            this.dismissNotification();
        });
    }

    async startRestCycle(username) {
        console.log('Starting rest cycle for:', username);

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
                console.log('Rest cycle started successfully');
                this.dismissNotification();
                // Refresh page to update dashboard
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                console.error('Failed to start rest cycle:', data.error);
                alert('Failed to start rest cycle: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error starting rest cycle:', error);
            alert('Error starting rest cycle. Please try again.');
        }
    }

    dismissNotification() {
        const modal = document.getElementById('refresh-notification-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
        console.log('Notification dismissed');
    }

    showVisualAlert(userData, restTime, timeUnit) {
        // Create visual alert bar at top of screen
        let alertBar = document.getElementById('refresh-visual-alert');
        if (!alertBar) {
            alertBar = document.createElement('div');
            alertBar.id = 'refresh-visual-alert';
            alertBar.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(45deg, #ef4444, #dc2626);
                color: white;
                text-align: center;
                padding: 15px;
                font-weight: bold;
                z-index: 1000;
                animation: pulse 2s infinite;
                border-bottom: 3px solid #991b1b;
            `;
            document.body.appendChild(alertBar);
        }

        alertBar.textContent = `🚨 WORK COMPLETE! Start your ${restTime} ${timeUnit} rest cycle now! 🚨`;
        alertBar.style.display = 'block';

        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (alertBar) {
                alertBar.style.display = 'none';
            }
        }, 10000);

        console.log('Visual alert shown');
    }

    playAudioAlert() {
        try {
            // Create audio context for mobile compatibility
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            if (audioContext.state === 'suspended') {
                audioContext.resume();
            }

            // Create beep sound
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 1);

            console.log('Audio alert played');
        } catch (error) {
            console.log('Audio alert failed:', error);
        }
    }

    triggerVibration() {
        if ('vibrate' in navigator) {
            navigator.vibrate([500, 200, 500, 200, 500]);
            console.log('Vibration triggered');
        }
    }

    showNoNotificationMessage() {
        // Show brief message that no notifications are pending
        let messageDiv = document.getElementById('refresh-status-message');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'refresh-status-message';
            messageDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #10b981;
                color: white;
                padding: 20px;
                border-radius: 8px;
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            document.body.appendChild(messageDiv);
        }

        messageDiv.textContent = '✓ No work completion notifications';
        messageDiv.style.display = 'block';

        // Auto-hide after 2 seconds
        setTimeout(() => {
            if (messageDiv) {
                messageDiv.style.display = 'none';
            }
        }, 2000);

        console.log('No notification message shown');
    }

    getRestTimeForZone(zone) {
        const restTimes = {
            'white': 15,
            'green': 15,
            'yellow': 15,
            'red': 30,
            'black': 30,
            'test': 10,
            'cutoff': 30
        };
        return restTimes[zone] || 15;
    }
}

// Initialize the notification system
const simpleRefreshNotifications = new SimpleRefreshNotifications();


console.log('Simple refresh notifications loaded');
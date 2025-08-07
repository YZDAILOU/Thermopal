// Enhanced work cycle completion notifications with progressive reminders
let notificationPermission = null;
let restReminderInterval = null;
let restReminderTimeout = null;
let audioContextInitialized = false;
let isMobile = false;

// Detect mobile browser
function detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    isMobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    return isMobile;
}

// Enhanced work cycle completion notifications with progressive reminders
class WorkCompletionModal {
    constructor() {
        this.dismissTimeout = null;
        this.progressiveReminderInterval = null;
        this.isDismissed = false;
        this.reminderCount = 0;
        detectMobile(); // Initialize mobile detection
    }

    showWorkCompletionModal(data) {
        console.log('Showing work completion modal:', data);
        
        // Clear any existing timers
        this.clearAllNotifications();
        
        // Create and show the modal
        const modal = document.getElementById('work-complete-modal');
        if (modal) {
            // Update modal content
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            
            if (modalTitle) modalTitle.textContent = data.title || 'Work Cycle Complete!';
            if (modalMessage) modalMessage.textContent = data.message || 'Great job! Time to start your rest cycle.';
            
            // Show the modal
            modal.classList.remove('hidden');
            
            // Set up event listeners
            this.setupModalEventListeners(data);
            
            // Play alert sound and vibration for mobile
            this.playAlertSound();
            if (isMobile && 'vibrate' in navigator) {
                navigator.vibrate([800, 300, 800, 300, 800, 300, 1000]);
            }
        }
    }

    setupModalEventListeners(data) {
        const startRestBtn = document.getElementById('start-rest-btn');
        const dismissBtn = document.getElementById('dismiss-modal-btn');
        
        if (startRestBtn) {
            startRestBtn.onclick = () => {
                console.log('Start rest button clicked');
                this.handleStartRest();
            };
        }
        
        if (dismissBtn) {
            dismissBtn.onclick = () => {
                console.log('Dismiss button clicked');
                this.handleDismiss(data);
            };
        }
    }

    handleStartRest() {
        // Clear all notifications and start rest cycle
        this.clearAllNotifications();
        
        // Hide modal
        const modal = document.getElementById('work-complete-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        // Call the server to start rest cycle
        fetch('/start_rest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                username: window.currentUser
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Rest cycle started successfully');
                // Update dashboard
                if (typeof window.updateDashboard === 'function') {
                    window.updateDashboard();
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

    handleDismiss(data) {
        console.log('Handling dismiss with data:', data);
        
        // Hide modal immediately
        const modal = document.getElementById('work-complete-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        
        // Mark as dismissed and store state
        this.isDismissed = true;
        this.reminderCount = 0;
        
        // Store dismissal state in localStorage with timestamps for progressive reminders
        const dismissedState = {
            username: data.username || window.currentUser,
            zone: data.zone,
            rest_time: data.rest_duration || this.getCorrectRestTime(data.zone),
            dismissedAt: Date.now(),
            reminderStartTime: Date.now() + 5000, // First reminder after 5 seconds
            action: 'work_cycle_completed'
        };
        
        localStorage.setItem('workCompletionDismissed', JSON.stringify(dismissedState));
        
        console.log('Work completion dismissed, progressive reminders will start in 5 seconds');
        
        // Disable zone buttons while in reminder state
        this.disableZoneButtons();
        
        // Start the progressive reminder system
        this.startProgressiveReminders(dismissedState);
    }

    startProgressiveReminders(dismissedState) {
        console.log('Starting progressive reminder system with state:', dismissedState);
        
        // Clear any existing reminders
        if (this.dismissTimeout) {
            clearTimeout(this.dismissTimeout);
        }
        if (this.progressiveReminderInterval) {
            clearInterval(this.progressiveReminderInterval);
        }
        
        // Set up first reminder after 5 seconds
        this.dismissTimeout = setTimeout(() => {
            console.log('Showing first progressive reminder (5 seconds after dismiss)');
            this.showProgressiveReminder(dismissedState);
            
            // Then show reminders every 10 seconds
            this.progressiveReminderInterval = setInterval(() => {
                console.log('Showing continuous progressive reminder (every 10 seconds)');
                this.showProgressiveReminder(dismissedState);
            }, 10000);
            
        }, 5000);
    }

    showProgressiveReminder(data) {
        this.reminderCount++;
        console.log(`Showing progressive reminder #${this.reminderCount} with data:`, data);
        
        // Show the modal again with reminder styling
        const modal = document.getElementById('work-complete-modal');
        if (modal) {
            // Update modal content for reminder
            const modalTitle = document.getElementById('modal-title');
            const modalMessage = document.getElementById('modal-message');
            
            if (modalTitle) {
                modalTitle.textContent = `Reminder #${this.reminderCount}: Start Your Rest!`;
            }
            if (modalMessage) {
                modalMessage.textContent = `You dismissed this ${this.reminderCount} time(s). You need to start your rest cycle.`;
            }
            
            // Show the modal
            modal.classList.remove('hidden');
            
            // Set up event listeners again
            this.setupModalEventListeners(data);
            
            // Play reminder sound and vibration
            this.playAlertSound();
            if (isMobile && 'vibrate' in navigator) {
                navigator.vibrate([500, 200, 500, 200, 500]);
            }
        } else {
            console.error('Could not find work-complete-modal element for progressive reminder');
        }
    }

    playAlertSound() {
        try {
            // Create audio context if not exists
            if (!window.audioContext) {
                window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Resume audio context if suspended (required for mobile)
            if (window.audioContext.state === 'suspended') {
                window.audioContext.resume();
            }
            
            // Create oscillator for beep sound
            const oscillator = window.audioContext.createOscillator();
            const gainNode = window.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(window.audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, window.audioContext.currentTime);
            gainNode.gain.setValueAtTime(0.3, window.audioContext.currentTime);
            
            oscillator.start(window.audioContext.currentTime);
            oscillator.stop(window.audioContext.currentTime + 0.3);
            
        } catch (e) {
            console.log('Could not play alert sound:', e);
        }
    }

    disableZoneButtons() {
        const zoneButtons = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3');
        if (zoneButtons) {
            zoneButtons.style.pointerEvents = 'none';
            zoneButtons.style.opacity = '0.5';
            zoneButtons.setAttribute('data-disabled-by-reminder', 'true');
            console.log('Zone buttons disabled due to pending rest');
        }
    }

    enableZoneButtons() {
        const zoneButtons = document.querySelector('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-3');
        if (zoneButtons) {
            zoneButtons.style.pointerEvents = '';
            zoneButtons.style.opacity = '';
            zoneButtons.removeAttribute('data-disabled-by-reminder');
            console.log('Zone buttons enabled');
        }
    }

    clearAllNotifications() {
        console.log('Clearing all work completion notifications');
        
        // Clear timers
        if (this.dismissTimeout) {
            clearTimeout(this.dismissTimeout);
            this.dismissTimeout = null;
        }
        if (this.progressiveReminderInterval) {
            clearInterval(this.progressiveReminderInterval);
            this.progressiveReminderInterval = null;
        }
        
        // Reset state
        this.isDismissed = false;
        this.reminderCount = 0;
        
        // Clear localStorage
        localStorage.removeItem('workCompletionDismissed');
        
        // Clear Chrome reminders if available
        if (typeof clearChromeReminders === 'function') {
            clearChromeReminders();
        }
        
        // Re-enable zone buttons
        this.enableZoneButtons();
    }

    getCorrectRestTime(zone) {
        const restTimes = {
            'white': 15,
            'green': 15, 
            'yellow': 15,
            'red': 30,
            'black': 30,
            'test': 10  // 10 seconds for test zone
        };
        return restTimes[zone] || 15;
    }

    // ENHANCED: Immediate work completion check for page refresh scenarios
    performImmediateWorkCompletionCheck() {
        console.log('Performing immediate work completion check after page refresh');
        
        fetch(`/get_user_state/${window.currentUser}`)
            .then(response => response.json())
            .then(data => {
                console.log('Immediate check - user state:', data);
                
                if (data.work_completed && data.pending_rest) {
                    console.log('FOUND PENDING WORK COMPLETION - Auto-showing modal after page refresh');
                    
                    // Use most stringent zone for rest calculation, fallback to current zone
                    const zoneForRest = data.most_stringent_zone || data.zone;
                    const restTime = this.getCorrectRestTime(zoneForRest);
                    console.log(`REST CALCULATION: Current zone: ${data.zone}, Most stringent: ${data.most_stringent_zone}, Using: ${zoneForRest}, Rest time: ${restTime}`);
                    
                    // Show modal immediately with enhanced visibility
                    this.showWorkCompletionModal({
                        title: '⚠️ WORK CYCLE COMPLETE! ⚠️',
                        message: `Your work cycle has ended. Time to start rest cycle!`,
                        username: window.currentUser,
                        zone: data.zone,
                        most_stringent_zone: zoneForRest,
                        rest_duration: restTime
                    });
                    
                    // Disable zone buttons immediately to prevent new work cycles
                    this.disableZoneButtons();
                    
                    // Play enhanced alert for page refresh scenarios
                    this.playEnhancedAlertSound();
                    
                    // Enhanced mobile vibration for attention
                    if (isMobile && 'vibrate' in navigator) {
                        navigator.vibrate([1000, 300, 1000, 300, 1000, 300, 1500]);
                    }

                    // PRODUCTION FIX: Force browser notification as secondary measure
                    this.showProductionNotification(data, restTime, zoneForRest);
                }
            })
            .catch(error => {
                console.error('Error in immediate work completion check:', error);
            });
    }

    // Production notification system - works without service workers
    showProductionNotification(data, restTime, zoneForRest) {
        console.log('Showing production notification for Chrome on Render');
        
        if (!('Notification' in window)) {
            console.log('Notification API not available');
            return;
        }

        // Check permission and show notification immediately
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification('Work Cycle Complete!', {
                    body: `Your work cycle has ended. Time to start rest cycle!`,
                    icon: '/static/icon-192.png',
                    tag: 'wbgt-production-notification',
                    requireInteraction: true,
                    silent: false
                });

                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                console.log('Production notification shown successfully');
            } catch (error) {
                console.error('Production notification failed:', error);
            }
        } else if (Notification.permission === 'default') {
            // Request permission and then show notification
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showProductionNotification(data, restTime);
                }
            });
        }
    }

    // ENHANCED: Enhanced alert sound for critical notifications  
    playEnhancedAlertSound() {
        try {
            // Play multiple alert tones for better attention
            this.playAlertSound();
            
            setTimeout(() => {
                this.playAlertSound();
            }, 500);
            
            setTimeout(() => {
                this.playAlertSound();
            }, 1000);
            
        } catch (e) {
            console.log('Could not play enhanced alert sound:', e);
        }
    }

    // Check for pending work completion on page load
    checkForPendingWorkCompletion() {
        if (!window.currentUser) return;

        console.log('Checking for pending work completion on page load');

        // ENHANCED: First, always check server state immediately for pending work completion
        // This ensures users see notifications even on fresh page loads
        this.performImmediateWorkCompletionCheck();

        // Check localStorage for dismissed notifications that need progressive reminders
        const dismissedData = localStorage.getItem('workCompletionDismissed');
        if (dismissedData) {
            try {
                const parsed = JSON.parse(dismissedData);
                const currentTime = Date.now();
                
                console.log('Found dismissed state in localStorage:', parsed);
                
                // If we're past the reminder start time, clear localStorage and start continuous reminders
                if (currentTime >= parsed.reminderStartTime && parsed.username === window.currentUser) {
                    console.log('Page refreshed after dismiss period - recovering continuous reminder state');
                    localStorage.removeItem('workCompletionDismissed');
                    
                    // Fetch current user state to verify they still need to start rest
                    fetch(`/get_user_state/${window.currentUser}`)
                        .then(response => response.json())
                        .then(data => {
                            if (data.work_completed && data.pending_rest) {
                                console.log('User still needs to start rest - starting continuous reminders');
                                this.disableZoneButtons();
                                
                                const notificationData = {
                                    username: parsed.username,
                                    zone: parsed.zone,
                                    rest_time: parsed.rest_time,
                                    action: 'work_cycle_completed'
                                };
                                
                                // Start continuous reminders immediately
                                this.showProgressiveReminder(notificationData);
                                this.progressiveReminderInterval = setInterval(() => {
                                    this.showProgressiveReminder(notificationData);
                                }, 10000);
                            }
                        });
                    return;
                }
                
                // If still within dismiss period, set up remaining timer for progressive reminder
                if (currentTime < parsed.reminderStartTime && parsed.username === window.currentUser) {
                    const remainingTime = parsed.reminderStartTime - currentTime;
                    console.log(`Page refreshed during dismiss period - ${remainingTime}ms remaining until first reminder`);
                    
                    this.disableZoneButtons();
                    
                    this.dismissTimeout = setTimeout(() => {
                        console.log('Recovered first progressive reminder after page refresh');
                        this.showProgressiveReminder(parsed);
                        
                        this.progressiveReminderInterval = setInterval(() => {
                            this.showProgressiveReminder(parsed);
                        }, 10000);
                        
                    }, remainingTime);
                    return;
                }
                
                // If the dismiss period has expired and we're still here, clean up
                console.log('Dismiss period expired, clearing localStorage');
                localStorage.removeItem('workCompletionDismissed');
            } catch (e) {
                console.error('Error parsing localStorage data:', e);
                localStorage.removeItem('workCompletionDismissed');
            }
        }

        // Normal check for pending work completion
        fetch(`/get_user_state/${window.currentUser}`)
            .then(response => response.json())
            .then(data => {
                console.log('Checking for pending work completion:', data);
                
                if (data.work_completed && data.pending_rest) {
                    console.log('Found pending work completion - showing modal');
                    
                    const restTime = this.getCorrectRestTime(data.zone);
                    
                    this.showWorkCompletionModal({
                        title: 'Work Cycle Complete!',
                        message: `Your work cycle has ended. Time to start rest cycle!`,
                        username: window.currentUser,
                        zone: data.zone,
                        rest_duration: restTime
                    });
                }
            })
            .catch(error => {
                console.error('Error checking for pending work completion:', error);
            });
    }
}

// Initialize the work completion modal system
const workModal = new WorkCompletionModal();

// Listen for rest cycle completion to re-enable zone buttons
if (typeof socket !== 'undefined') {
    socket.on('user_update', function(data) {
        if (data.user === window.currentUser && data.status === 'idle' && !data.work_completed && !data.pending_rest) {
            // Rest cycle completed or user reset to idle
            workModal.clearAllNotifications();
        }
    });
}

// ENHANCED: Check for pending work completion on page load with immediate response
document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.currentUser !== 'undefined' && window.currentUser) {
        // Immediate check without delay for faster response
        workModal.checkForPendingWorkCompletion();
        
        // Also check again after a brief delay to ensure DOM is fully loaded
        setTimeout(() => {
            workModal.checkForPendingWorkCompletion();
        }, 500);
    }
});

// ENHANCED: Also check when page becomes visible (for tab switching scenarios)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && typeof window.currentUser !== 'undefined' && window.currentUser) {
        console.log('Page became visible - checking for pending work completion');
        workModal.checkForPendingWorkCompletion();
    }
});

// Make workModal available globally
window.workModal = workModal;
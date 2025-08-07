// WBGT Tracker - Main JavaScript
// This file consolidates and fixes the Socket.io event handlers and system interaction

// Global variables  
let timerInterval = null;
let lastZone = null;
let lastEndTime = null;
let socketio = null;
let pollingInterval = null;
let serverTimeOffset = 0; // Server time synchronization
let zoneButtonsContainer = null;

// Server time synchronization functions
function getServerSynchronizedTime() {
  return new Date(Date.now() + serverTimeOffset);
}

async function synchronizeWithServerTime() {
  try {
    const response = await fetch('/get_server_time');
    const data = await response.json();

    const serverTimestamp = data.timestamp * 1000;
    const localTimestamp = Date.now();
    serverTimeOffset = serverTimestamp - localTimestamp;

    console.log(`Server time sync: offset = ${serverTimeOffset}ms`);
  } catch (error) {
    console.error('Failed to sync with server time:', error);
    serverTimeOffset = 0;
  }
}

// Initialize Socket.io connection
document.addEventListener('DOMContentLoaded', async function() {
  // First, synchronize with server time
  await synchronizeWithServerTime();

  // Re-sync every 30 seconds
  setInterval(synchronizeWithServerTime, 30000);

  // Get username and role from the page (use window.currentUser and window.userRole from dashboard template)

  // Initialize Enhanced Notification System
  if (window.enhancedNotificationManager && window.currentUser) {
    console.log('Initializing enhanced notifications for:', window.currentUser);
    try {
      await window.enhancedNotificationManager.initialize(window.currentUser);
      console.log('Enhanced notification system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize enhanced notifications:', error);
    }
  }

  // Initialize Socket.io
  if (typeof io !== 'undefined') {
    socketio = io();

    // Socket.io connection handlers
    socketio.on('connect', function() {
      console.log('Socket.io connected successfully');
      fetchSystemStatus();
      updateDashboard();
      if (pollingInterval) {
        stopPolling();
      }
    });

    // Handle work complete modal
    socketio.on('show_work_complete_modal', function(data) {
      console.log('Received work complete modal:', data);
      if (data.username === window.currentUser) {
        showWorkCompleteModal(data);
      }
    });

    socketio.on('connect_error', function(error) {
      console.error('Socket.io connection error:', error);
      startPolling();
    });

    socketio.on('disconnect', function(reason) {
      console.warn('Socket.io disconnected:', reason);
      if (reason !== 'io client disconnect') {
        startPolling();
      }
    });

    socketio.on('reconnect', function(attemptNumber) {
      console.log('Socket.io reconnected after', attemptNumber, 'attempts');
      fetchSystemStatus();
      updateDashboard();
      stopPolling();
    });

    socketio.on('reconnect_error', function(error) {
      console.error('Socket.io reconnection error:', error);
    });

    // Debug all events
    socketio.onAny((event, ...args) => {
      console.log(`Received socket event: ${event}`, args);
    });

    // Handle system status updates
    socketio.on('system_status_update', function(data) {
      console.log("System status update received:", data);
      updateSystemStatusUI(data);
    });

    // Handle history updates
    socketio.on('history_update', function(data) {
      updateHistoryTable(data.history || []);

      // Check if current user started rest cycle and clear reminders
      if (data.history && window.currentUser) {
        const latestEntry = data.history[data.history.length - 1];
        if (latestEntry && latestEntry.username === window.currentUser && latestEntry.action === 'start_rest') {
          console.log('User started rest cycle, clearing reminders');
          if (typeof clearRestReminders === 'function') {
            clearRestReminders();
          }
        }
      }

      // Update zone restrictions after history changes
      setTimeout(checkZoneRestrictions, 500);
    });

    // Handle user updates
    socketio.on('user_update', function(data) {
      console.log('User update received:', data);
      updateDashboard();
      checkZoneRestrictions();
    });

    // Handle rest cycle completion
    socketio.on('rest_cycle_completed', function(data) {
      if (data.user === window.currentUser) {
        console.log('Rest cycle completed for current user');
        enableZoneButtons();
        clearTimer();
        checkZoneRestrictions();
      }
    });
  } else {
    console.error('Socket.io not loaded. Falling back to polling.');
    startPolling();
  }
});

// Update UI based on system status
function updateSystemStatusUI(data) {
  // Update UI based on system status
  const zoneButtons = document.querySelector('.w-full.max-w-xs');
  const zonesHeading = document.querySelector('h3.mt-6.text-lg.font-semibold');
  const stopButtonContainer = document.getElementById('stop-button-container');

  // First, remove any existing notifications from the page
  const existingCutOffWarning = document.querySelector('.bg-red-100');
  if (existingCutOffWarning) {
    existingCutOffWarning.remove();
  }

  const existingRestWarning = document.querySelector('.bg-yellow-100');
  if (existingRestWarning) {
    existingRestWarning.remove();
  }

  // Handle cut-off mode
  if (data.cut_off === true) {
    console.log("Cut-off mode is active, updating UI");

    // Create and insert the cut-off warning
    const cutOffWarning = document.createElement('div');
    cutOffWarning.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4';
    cutOffWarning.innerHTML = `
      <strong class="font-bold">Cut-Off Mode Active!</strong>
      <p class="text-sm">All activities must stop. Please wait for further instructions.</p>
    `;

    // Insert in the right location
    if (zonesHeading && zonesHeading.nextElementSibling) {
      zonesHeading.parentNode.insertBefore(cutOffWarning, zonesHeading.nextElementSibling);
    } else if (zoneButtons) {
      zoneButtons.parentNode.insertBefore(cutOffWarning, zoneButtons);
    }

    // Disable zone buttons
    if (zoneButtons) {
      zoneButtons.style.pointerEvents = 'none';
      zoneButtons.style.opacity = '0.5';
    }

    // Clear any active timer
    if (window.timerInterval) {
      clearTimer();
      window.lastZone = null;
      lastEndTime = null;
    }

    // Hide stop button if visible
    if (stopButtonContainer) {
      stopButtonContainer.style.display = 'none';
    }
  } 
  // Handle mandatory rest period
  else if (data.cut_off_end_time) {
    console.log("Mandatory rest period is active, updating UI");

    // Create and insert the rest warning
    const restWarning = document.createElement('div');
    restWarning.className = 'bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative mb-4';

    // Format the time for better readability
    let endTime;

    // Check if the time is a string in HH:MM:SS format or a Date object
    if (typeof data.cut_off_end_time === 'string' && data.cut_off_end_time.includes(':')) {
      endTime = new Date();
      const timeParts = data.cut_off_end_time.split(':');
      endTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2] || 0));
    } else {
      endTime = new Date(data.cut_off_end_time);
    }

    let formattedTime = endTime.toLocaleTimeString();

    restWarning.innerHTML = `
      <strong class="font-bold">Mandatory Rest Period</strong>
      <p class="text-sm">Normal activities will resume after: ${formattedTime}</p>
    `;

    // Insert in the right location
    if (zonesHeading && zonesHeading.nextElementSibling) {
      zonesHeading.parentNode.insertBefore(restWarning, zonesHeading.nextElementSibling);
    } else if (zoneButtons) {
      zoneButtons.parentNode.insertBefore(restWarning, zoneButtons);
    }

    // Disable zone buttons for trainers
    const userRole = document.querySelector('meta[name="user-role"]')?.content || '';
    if (zoneButtons && userRole === 'Trainer') {
      zoneButtons.style.pointerEvents = 'none';
      zoneButtons.style.opacity = '0.5';
    }

    // IMPORTANT CHANGE: Hide stop button during mandatory rest
    if (stopButtonContainer) {
      stopButtonContainer.style.display = 'none';
    }
  } 
  // Normal operation - no warnings
  else {
    console.log("Normal operation, removing warnings");

    // Re-enable zone buttons
    if (zoneButtons) {
      zoneButtons.style.pointerEvents = '';
      zoneButtons.style.opacity = '';
    }

    // Make sure dashboard is updated with current state
    if (!window.timerInterval) {
      updateDashboard();
    }
  }
}

// Start a WBGT zone cycle
function startZone(zone) {
  // Prevent starting a new cycle if system is in cut-off mode
  fetchSystemStatus().then(status => {
    if (status.cut_off) {
      alert('System is in cut-off mode. Cannot start new cycles.');
      return;
    }

    if (status.cut_off_end_time) {
      const userRole = document.querySelector('meta[name="user-role"]')?.content || '';
      if (userRole === 'Trainer') {
        alert('Mandatory rest period is active. Cannot start new cycles.');
        return;
      }
    }

    // Make AJAX request to set zone
    fetch('/set_zone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: window.currentUser,
        zone: zone
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to set zone');
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Zone set successfully:', data);
      updateDashboard();
    })
    .catch(error => {
      console.error('Error starting rest cycle:', error);
      alert(`Error: ${error.message}`);
    });
  });
}

// Test cycle function
function startTestCycle() {
  // Similar to startZone but specifically for test cycle
  startZone('test');
}

// Stop the current cycle early
function stopCycleEarly() {
  fetch('/stop_cycle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: window.currentUser
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.error || 'Failed to stop cycle');
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Cycle stopped successfully:', data);
    clearTimer();
    updateDashboard();
  })
  .catch(error => {
    console.error('Error stopping cycle:', error);
    alert(`Error: ${error.message}`);
  });
}

// Update dashboard with latest data
function updateDashboard() {
  if (!window.currentUser) return;

  fetch(`/get_user_state/${window.currentUser}`)
    .then(response => response.json())
    .then(data => {
      // Update timer display based on user state
      if ((data.status === 'working' || data.status === 'resting') && data.end_time) {
        startTimer(data.start_time, data.end_time, data.zone);
      } else {
        clearTimer();
      }

      // Update zone button states
      checkZoneRestrictions();
    })
    .catch(error => {
      console.error('Error fetching user state:', error);
    });
}

// Start the timer display
function startTimer(startTime, endTime, zone) {
  // Check if timer is already running for the same end time and zone
  if (timerInterval && lastZone === zone && lastEndTime === endTime) {
    console.log('Timer already running for same zone and end time');
    return;
  }

  // Check if we need to restart the timer
  const zoneChanged = lastZone !== zone;
  const endTimeChanged = lastEndTime !== endTime;

  if (timerInterval && (zoneChanged || endTimeChanged)) {
    console.log('Restarting timer - Zone changed:', zoneChanged, 'End time changed:', endTimeChanged);
    clearTimer();
  }

  // Don't start new timer if one is already running and nothing changed
  if (timerInterval && !zoneChanged && !endTimeChanged) {
    return;
  }

  // Parse times with exact precision (no milliseconds)
  const startDate = parseTimeString(startTime);
  const endDate = parseTimeString(endTime, true, startTime);

  // Store these for reference
  lastZone = zone;
  lastEndTime = endTime;

  // Log for debugging
  console.log(`Starting timer for ${zone} zone from ${startTime} to ${endTime}`);

  // Update the timer display
  const timerElement = document.getElementById('timer');
  if (!timerElement) return;

  // Precise timer calculation for consistent display across platforms
  function updateTimerDisplay() {
    const now = getServerSynchronizedTime(); // Use server-synchronized time
    // Calculate exact remaining time in milliseconds, then round up to next second
    const timeLeftMs = Math.max(0, endDate - now);
    const timeLeft = Math.ceil(timeLeftMs / 1000); // Round UP for consistency
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    if (timerElement) {
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // Stop timer when it reaches zero
    if (timeLeft <= 0) {
      clearTimer();
      updateDashboard();
      return false;
    }
    return true;
  }

  // Show initial time immediately
  updateTimerDisplay();

  // TIMER FIX: For first second, always show exact zone duration (60:00 for white)
  // This ensures the timer always starts with the exact zone duration
  const zoneDuration = zoneDurations[zone] || 0;

  // Start the interval timer using the precise update function
  timerInterval = setInterval(() => {
    if (!updateTimerDisplay()) {
      clearTimer(); // Timer finished, stop the interval
    }
  }, 1000);

  // Also update immediately for current time
  const timeLeft = Math.max(0, endDate - now);
  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  if (timerElement) {
    timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // Show the stop button
  const stopButton = document.getElementById('stop-button-container');
  if (stopButton) {
    stopButton.style.display = 'block';
  }
}

// Clear the timer
function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Reset the timer display if it exists
  const timerElement = document.getElementById('timer');
  if (timerElement) {
    timerElement.textContent = '--:--';
  }

  // Hide the stop button
  const stopButton = document.getElementById('stop-button-container');
  if (stopButton) {
    stopButton.style.display = 'none';
  }
}

// Modal handling functions
function showWorkCompleteModal(data) {
  const modal = document.getElementById('work-complete-modal');
  if (!modal) return;
  
  const title = document.getElementById('modal-title');
  const message = document.getElementById('modal-message');
  
  if (title) title.textContent = data.title;
  if (message) message.textContent = data.message;
  
  // Show modal
  modal.classList.remove('hidden');
  
  console.log('Work complete modal shown for:', data.username);
}

function hideWorkCompleteModal() {
  const modal = document.getElementById('work-complete-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Parse a time string into a Date object with exact precision
function parseTimeString(timeStr, isEndTime = false, startTime = null) {
  if (!timeStr) return new Date();

  const now = new Date();
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);

  // Create a new date with seconds precision, no milliseconds
  const date = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours || 0,
    minutes || 0,
    seconds || 0,
    0  // explicitly set milliseconds to 0 for exact timing
  );

  // Handle midnight rollover: if this is an end time and it's earlier than start time,
  // it means the end time is on the next day
  if (isEndTime && startTime) {
    const startHours = parseInt(startTime.split(':')[0]);
    const endHours = hours || 0;
    
    // If end time is significantly earlier than start time, assume next day
    // Using 12-hour threshold to handle cases like 23:xx to 01:xx
    if (endHours < startHours && (startHours - endHours) > 12) {
      date.setDate(date.getDate() + 1);
      console.log(`Midnight rollover detected: ${timeStr} moved to next day`);
    }
  }

  return date;
}

// Fetch system status via AJAX
function fetchSystemStatus() {
  return fetch('/get_system_status')
    .then(response => response.json())
    .then(data => {
      console.log("Fetched system status:", data);
      updateSystemStatusUI(data);
      return data;
    })
    .catch(error => {
      console.error("Error fetching system status:", error);
      return {}; // Return empty object on error
    });
}

// Polling mechanism for when socket connection is lost
function startPolling() {
  if (!pollingInterval) {
    console.log("Starting polling for updates");
    pollingInterval = setInterval(fetchSystemStatus, 5000); // Poll every 5 seconds
  }
}

function stopPolling() {
  if (pollingInterval) {
    console.log("Stopping polling for updates");
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Update history table with latest data
function updateHistoryTable(history) {
  if (!history || !history.length) return;

  const historyTbody = document.querySelector('#history-table tbody');
  if (!historyTbody) return;

  // Get the latest 20 entries
  const latestEntries = history.slice(-20).reverse();

  historyTbody.innerHTML = latestEntries.map(entry => `
    <tr>
      <td class="px-4 py-3 text-sm">${entry.timestamp}</td>
      <td class="px-4 py-3 text-sm">${entry.username}</td>
      <td class="px-4 py-3 text-sm">${entry.action.replace('_', ' ')}</td>
      <td class="px-4 py-3 text-sm">${entry.zone || '-'}</td>
      <td class="px-4 py-3 text-sm">${
        entry.action === 'completed_work' ? 'Work cycle completed' :
        entry.action === 'completed_rest' ? 'Rest cycle completed' :
        entry.action === 'start_rest' ? 'Started rest period' :
        entry.action === 'early_completion' ? 'Cycle ended early by user' : ''
      }</td>
    </tr>
  `).join('');
}

// Admin functions for WBGT system control
function confirmCutOff() {
  const isCutOffActive = document.querySelector('button[onclick="confirmCutOff()"]').textContent.includes('Deactivate');

  if (isCutOffActive) {
    if (confirm('Are you sure you want to deactivate cut-off mode?')) {
      setCutOffMode(false);
    }
  } else {
    if (confirm('Are you sure you want to activate cut-off mode? This will immediately stop all activities.')) {
      setCutOffMode(true);
    }
  }
}

function setCutOffMode(enable) {
  fetch('/set_cut_off', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      enable: enable.toString()
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.error || 'Failed to set cut-off mode');
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Cut-off mode updated successfully:', data);
    fetchSystemStatus(); // Refresh system status
  })
  .catch(error => {
    console.error('Error setting cut-off mode:', error);
    alert(`Error: ${error.message}`);
  });
}

function updateSelectedUsers(zone) {
  const checkboxes = document.querySelectorAll('.user-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select at least one trainer');
    return;
  }

  const userIds = Array.from(checkboxes).map(cb => cb.value);

  Promise.all(userIds.map(userId => {
    return fetch('/set_zone_for_user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: window.currentUser,
        target_user: userId,
        zone: zone
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(`Failed for ${userId}: ${data.error}`);
        });
      }
      return response.json();
    });
  }))
  .then(results => {
    console.log('Updated zones for users:', results);
    fetchSystemStatus(); // Refresh system status
  })
  .catch(error => {
    console.error('Error updating users:', error);
    alert(`Error: ${error.message}`);
  });
}

function clearCommands() {
  if (confirm('Are you sure you want to clear all pending commands?')) {
    fetch('/clear_commands', {
      method: 'POST'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to clear commands');
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Commands cleared successfully:', data);
      fetchSystemStatus(); // Refresh system status
    })
    .catch(error => {
      console.error('Error clearing commands:', error);
      alert(`Error: ${error.message}`);
    });
  }
}

function resetLogs() {
  if (confirm('Are you sure you want to reset all user logs? This cannot be undone.')) {
    fetch('/reset_logs', {
      method: 'POST'
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'Failed to reset logs');
        });
      }
      return response.json();
    })
    .then(data => {
      console.log('Logs reset successfully:', data);
      location.reload(); // Reload the page to reflect changes
    })
    .catch(error => {
      console.error('Error resetting logs:', error);
      alert(`Error: ${error.message}`);
    });
  }
}

// Zone button control functions
function disableZoneButtons() {
  const zoneButtons = document.querySelector('.w-full.max-w-xs');
  if (zoneButtons) {
    zoneButtons.style.pointerEvents = 'none';
    zoneButtons.style.opacity = '0.5';
    console.log('Zone buttons disabled');
  }
}

function enableZoneButtons() {
  const zoneButtons = document.querySelector('.w-full.max-w-xs');
  if (zoneButtons) {
    zoneButtons.style.pointerEvents = '';
    zoneButtons.style.opacity = '';
    console.log('Zone buttons enabled');
  }
}

// Check zone restrictions and update button states
function checkZoneRestrictions() {
  if (!window.currentUser) return;

  fetch(`/get_user_state/${window.currentUser}`)
    .then(response => response.json())
    .then(data => {
      const restrictions = {
        systemCutOff: false,
        mandatoryRest: null,
        disabledByReminder: false,
        disabledByPendingRest: data.pending_rest || false,
        disabledByRest: data.status === 'resting',
        workCompleted: data.work_completed || false,
        pendingRest: data.pending_rest || false
      };

      // Check system status
      fetch('/get_system_status')
        .then(response => response.json())
        .then(systemStatus => {
          restrictions.systemCutOff = systemStatus.cut_off;
          restrictions.mandatoryRest = systemStatus.cut_off_end_time;

          const shouldDisable = restrictions.systemCutOff || 
                               restrictions.mandatoryRest || 
                               restrictions.disabledByRest ||
                               restrictions.disabledByPendingRest ||
                               (data.status === 'working');

          if (shouldDisable) {
            disableZoneButtons();
            if (data.status === 'working') {
              console.log('Zones disabled - work cycle active');
            } else {
              console.log('Zones kept disabled - restrictions still apply:', restrictions);
            }
          } else {
            enableZoneButtons();
            console.log('Zones enabled - no restrictions');
          }
        })
        .catch(error => console.error('Error checking system status:', error));
    })
    .catch(error => console.error('Error checking user state:', error));
}

// Universal rest start function that can be called from notifications
window.startRest = function(zone) {
  console.log('Starting rest cycle for zone:', zone);
  
  if (!window.currentUser) {
    console.error('Cannot start rest - no current user');
    return;
  }

  fetch('/start_rest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: window.currentUser,
      zone: zone
    })
  })
  .then(response => {
    if (!response.ok) {
      return response.json().then(data => {
        throw new Error(data.error || 'Failed to start rest cycle');
      });
    }
    return response.json();
  })
  .then(data => {
    console.log('Rest cycle started successfully:', data);
    
    // Update dashboard immediately
    updateDashboard();
    
    // Check zone restrictions
    checkZoneRestrictions();
    
    // Mark as notified in enhanced notification system
    if (window.enhancedNotificationManager) {
      window.enhancedNotificationManager.markAsNotified();
    }
  })
  .catch(error => {
    console.error('Error starting rest cycle:', error);
    alert(`Error starting rest cycle: ${error.message}`);
  });
};

// Initial status check at page load
document.addEventListener('DOMContentLoaded', function() {
  zoneButtonsContainer = document.querySelector('.w-full.max-w-xs');
  fetchSystemStatus();

  // Check zone restrictions periodically
  setInterval(checkZoneRestrictions, 2000);
});

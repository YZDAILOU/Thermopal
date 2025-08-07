# WBGT Training Conduct Management System

## Project Overview
This is a comprehensive Flask-based web application for managing training conducts with WBGT (Wet Bulb Globe Temperature) monitoring capabilities. The system helps military/training units organize and monitor training sessions with proper heat stress management and most stringent zone safety logic.

## Recent Changes
- **August 7, 2025**: Fixed conducting body interface countdown accuracy
  - **BUG FIX**: Monitor interface countdown now matches trainer interface accuracy  
  - **TIMING ISSUE**: Conducting body countdown was starting from 59:57 instead of 60:00/59:59
  - **SERVER SYNC**: Updated monitor.html to use server-synchronized time instead of local time
  - **MATH PRECISION**: Changed from Math.ceil to Math.floor for accurate countdown calculations
  - **CONSISTENCY**: Both trainer and conducting body interfaces now show identical timer accuracy
- **August 6, 2025**: Fixed activity log formatting for rest periods
  - **BUG FIX**: Eliminated decimal formatting in activity history (e.g., "0.16666666666666666 minute" → "10 second")
  - **IMPROVED LOGIC**: Activity logging now uses zone_for_rest instead of user.zone for proper test zone detection
  - **CLEAN DISPLAY**: TEST zone rest periods show as "10 second" instead of decimal minutes
  - **ENHANCED**: All other zones show clean integer minutes (15 minute, 30 minute) in activity logs
- **August 6, 2025**: Completed notification message simplification - ALL systems updated
  - **MAIN NOTIFICATIONS**: Work completion message: "Your work cycle has ended. Time to start rest cycle!"
  - **REMINDER MESSAGES**: Simplified to "You dismissed this X time(s). You need to start your rest cycle."
  - **BROWSER REMINDERS**: Updated to "Don't forget: You need to start your rest cycle!"
  - **UPDATED FILES**: Modified work-notifications.js, firebase-notifications.js, chrome-notifications.js, and dashboard.html
  - **COMPLETE**: All 4+ notification systems now use simplified messages without zone names or time durations
  - **USER EXPERIENCE**: Consistent, professional messaging across all notification types
- **August 6, 2025**: Fixed critical most stringent zone logic bug
  - **BUG FIX**: Backend API now returns most_stringent_zone field in get_user_state response
  - **FRONTEND FIX**: JavaScript now uses most_stringent_zone instead of current zone for rest calculations
  - **VALIDATION**: Test→white sequence now correctly shows 10 seconds rest (TEST zone) instead of 15 minutes (WHITE zone)
  - **VERIFICATION**: Most stringent zone logic working correctly for all scenarios
- **August 6, 2025**: Completed comprehensive WBGT zone testing and corrected TEST zone configuration
  - **ZONE TESTING**: Successfully tested complex sequence (white→green→red→green→yellow→black→white→test→black→green)
  - **TEST ZONE FIX**: Corrected TEST zone from 10 minutes rest to 10 SECONDS rest (7 sec work, 10 sec rest)
  - **VALIDATION**: Confirmed most stringent zone logic works correctly - rest time based on harshest zone in cycle
  - **VERIFIED**: Complex sequences properly track highest stringency level throughout entire work cycle
- **Earlier today**: Completed implementation of most stringent zone logic for enhanced WBGT safety
  - **NEW FEATURE**: Rest duration now based on harshest zone worked during current cycle (safety-critical)
  - Added `most_stringent_zone` field to User model with automatic tracking during work cycles
  - Implemented zone stringency hierarchy: WHITE(0) < GREEN(1) < YELLOW(2) < RED(3) < BLACK(4) < CUT-OFF(5) < TEST(6)
  - Enhanced rest cycle calculation to use most stringent zone instead of current zone
  - Added comprehensive zone tracking with automatic reset after rest completion
  - **EXAMPLE**: Trainer working White→Green→Black gets 30min rest (Black), not 15min rest (White)
  - Successfully tested and verified zone logic with database schema migration
- **Earlier today**: Implemented 24-hour auto-deactivation and reactivation feature for conducts
  - Conducts automatically become inactive after 24 hours if no users join
  - Inactive conducts automatically reactivate when users attempt to join them
  - Updated UI to show "Join & Reactivate" buttons for inactive conducts
  - Added background task monitoring for conduct activity every minute
  - Updated database schema to use 'inactive' status instead of 'archived'
  - Added activity logging for both deactivation and reactivation events
  - **FIXED**: Resolved timing issue with `last_activity_at` field to prevent immediate re-deactivation
  - Added proper 24-hour timer reset upon reactivation to ensure consistent behavior

## Core Features

### Conduct Management
- **Creation**: Companies can create training conducts with unique 6-digit PINs
- **Status Tracking**: Conducts have active/inactive status with visual indicators
- **Auto-deactivation**: Conducts automatically become inactive after 24 hours with no participants
- **Auto-reactivation**: Inactive conducts automatically reactivate when users attempt to join
- **Hierarchical Structure**: Battalion → Company → Conduct organization
- **Activity Logging**: All status changes are logged with timestamps

### User Roles
- **Trainers**: Participate in work/rest cycles based on WBGT zones
- **Conducting Body**: Manage the conduct, control cut-off modes
- **Monitors**: Observe conduct activities without participating

### WBGT Zone Management
- **Color-coded zones**: White, Green, Yellow, Red, Black, Test, Cut-off
- **Automated timing**: Work and rest periods based on zone conditions
- **Most stringent zone logic**: Rest duration calculated from harshest zone worked during current cycle
- **Safety hierarchy**: WHITE(15min) < GREEN(15min) < YELLOW(15min) < RED(30min) < BLACK(30min) < CUT-OFF(30min) < TEST(10s)
- **Real-time monitoring**: Live updates of user status and cycles with zone stringency tracking

### Real-time Features
- **Socket.IO integration**: Live updates for all participants
- **Background tasks**: Automatic cycle completion detection
- **Activity logging**: Comprehensive audit trail of all actions

## Project Architecture

### Backend (Flask)
- **main.py**: Main application with routes and business logic
- **models.py**: SQLAlchemy database models
- **Background tasks**: Eventlet-based concurrent task processing

### Database Models
- **Battalion**: Top-level military unit
- **Company**: Sub-unit within battalion
- **Conduct**: Individual training session
- **User**: Participants in conducts (now includes `most_stringent_zone` field for safety tracking)
- **Session**: User session tracking
- **ActivityLog**: Audit trail of actions including zone stringency decisions

### Frontend (Jinja2 Templates)
- **Responsive design**: TailwindCSS for modern UI
- **Real-time updates**: JavaScript with Socket.IO client
- **Status indicators**: Visual feedback for conduct and user states

### Key Technical Components
- **Auto-deactivation**: `check_conduct_activity()` function runs every minute
- **Cycle monitoring**: `check_user_cycles()` function runs every second with stringent zone tracking
- **Zone stringency logic**: `get_most_stringent_zone()` and `get_rest_duration_for_most_stringent_zone()` functions
- **Real-time communication**: Socket.IO rooms for conduct-specific updates
- **Caching**: User data caching to reduce database queries

## Database Schema Notes
- **Conduct.status**: 'active' (default) or 'inactive'
- **Conduct.created_at**: UTC timestamp for 24-hour calculation
- **User.conduct_id**: Foreign key relationship to conducts
- **User.most_stringent_zone**: Tracks harshest zone worked during current cycle (reset after rest)
- **ActivityLog**: Tracks all significant actions including auto-deactivation and zone decisions

## Configuration
- **Database**: PostgreSQL (production) or SQLite (fallback)
- **Session secret**: Environment variable or dev default
- **Socket.IO**: Eventlet async mode with CORS enabled
- **Background tasks**: Automatic startup with application

## User Preferences
- No specific user preferences documented yet

## Deployment Notes
- **Gunicorn**: WSGI server for production deployment
- **Eventlet**: Async worker class for Socket.IO compatibility
- **Port binding**: 0.0.0.0:5000 for external access
- **Background tasks**: Start automatically on deployment

## Security Features
- **PIN-based access**: 6-digit unique PINs for conduct joining
- **Role-based permissions**: Different capabilities per user role
- **Password protection**: Company and battalion level authentication
- **Status validation**: Prevents joining inactive conducts

## Future Considerations
- Consider notification system for conduct deactivation
- Potential manual reactivation feature for conducts
- Extended analytics for conduct usage patterns
- Mobile app integration possibilities
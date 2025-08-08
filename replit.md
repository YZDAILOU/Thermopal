# WBGT Training Conduct Management System (ThermoPal)

## Project Overview
This is a comprehensive Flask-based web application for managing training conducts with WBGT (Wet Bulb Globe Temperature) monitoring capabilities. The system helps military/training units organize and monitor training sessions with proper heat stress management and most stringent zone safety logic.

## Program Understanding (August 8, 2025)
**ThermoPal** is a sophisticated real-time training management system that:
- Manages military/training conducts with unique 6-digit PINs
- Implements WBGT heat zone safety protocols (WHITE, GREEN, YELLOW, RED, BLACK, TEST, CUT-OFF)
- Uses "most stringent zone" logic - rest time based on harshest conditions worked during cycle
- Provides real-time Socket.IO communication between trainers and participants
- Features comprehensive multi-platform notification system for work/rest cycle management

## Static Folder File Purposes

### Core Application Files
- **main.js**: Central JavaScript controller managing Socket.IO, server time sync, work completion modals, and dashboard updates
- **icon-192.png**: Application icon for notifications, PWA manifest, and browser branding

### Multi-Layered Notification System
The application implements a redundant notification strategy ensuring compatibility across all browsers and devices:

#### Primary Notification Layer
- **enhanced-notifications.js**: Universal notification manager with background monitoring and service worker integration
- **sw.js**: Main service worker for background task management, caching, and notification handling

#### Browser-Specific Layers
- **chrome-notifications.js**: Chrome-specific push notifications with permission management and action buttons
- **chrome-sw.js**: Chrome service worker for notification clicks and progressive reminder system
- **firefox-notifications.js**: Firefox-specific notification handling (if present)

#### Firebase Integration
- **firebase-notifications.js**: Firebase Cloud Messaging for cross-platform push notifications with mobile optimization
- **firebase-messaging-sw.js**: Firebase background message handling with action button integration

#### Production & Fallback Systems
- **production-notifications.js**: Production-optimized system with 5-second refresh cycles for Chrome on Render
- **work-notifications.js**: Work cycle completion management with progressive reminders and mobile vibration
- **simple-refresh-notifications.js**: Manual refresh-based system for iOS Safari and restrictive browsers

## Recent Changes
- **August 8, 2025**: Program analysis completed - identified comprehensive WBGT training management system
  - **ARCHITECTURE**: Multi-layered notification system with 8 different notification strategies
  - **SAFETY CRITICAL**: "Most stringent zone" logic ensures proper rest based on harshest conditions worked
  - **REAL-TIME**: Socket.IO integration for instant communication between all participants
  - **CROSS-PLATFORM**: Firebase integration with mobile optimization and progressive web app features
  - **PRODUCTION READY**: Multiple fallback systems ensure notifications work in all deployment environments

## Core Features

### Conduct Management
- **Creation**: Companies can create training conducts with unique 6-digit PINs
- **Joining**: Users join conducts and are tracked in real-time
- **Status Tracking**: Active/inactive conduct management with 24-hour auto-deactivation
- **Real-time Updates**: Socket.IO for instant status synchronization

### WBGT Zone Management
- **Zone Types**: WHITE (60min work/15min rest) → GREEN (45/15) → YELLOW (30/15) → RED (30/30) → BLACK (15/30) → TEST (7sec/10sec) → CUT-OFF (0/30)
- **Most Stringent Logic**: Rest duration based on harshest zone worked during current cycle
- **Zone Hierarchy**: WHITE(0) < GREEN(1) < YELLOW(2) < RED(3) < BLACK(4) < CUT-OFF(5) < TEST(6)
- **Safety Critical**: Automatic tracking prevents heat-related injuries

### Database Models
- **Battalion**: Top-level military unit
- **Company**: Sub-unit within battalion
- **Conduct**: Individual training session
- **User**: Participants in conducts (includes `most_stringent_zone` field for safety tracking)
- **Session**: User session tracking
- **ActivityLog**: Comprehensive audit trail

### Frontend (Jinja2 Templates)
- **Responsive design**: TailwindCSS for modern UI
- **Real-time updates**: JavaScript with Socket.IO client
- **Status indicators**: Visual feedback for conduct and user states
- **Mobile optimized**: Progressive Web App features with offline capability

### Notification Architecture
- **Multi-browser support**: Chrome, Firefox, Safari compatibility
- **Background processing**: Service workers for notifications when app is closed
- **Progressive reminders**: Escalating alert system for missed notifications
- **Mobile features**: Vibration, audio alerts, and push notification integration
- **Production deployment**: Render platform optimization with multiple fallback systems

## User Preferences
- Technical communication style preferred for system analysis
- Comprehensive documentation of all system components
- Focus on safety-critical aspects of WBGT monitoring
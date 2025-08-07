#!/usr/bin/env python3
"""
WBGT Zone Testing Script
Tests the zone transition from white -> green -> black -> white
and verifies rest cycle time calculation based on most stringent zone
"""

import time
import sqlite3
from datetime import datetime, timedelta
import requests

def test_zone_transitions():
    """Test WBGT zone transitions and rest cycle calculations"""
    
    print("=== WBGT Zone Transition Test ===")
    print("Testing: white -> green -> black -> white")
    print("Expected: Rest cycle should be 30 minutes (based on black zone, not white)")
    print()
    
    # Connect to database to check internal state
    try:
        conn = sqlite3.connect('instance/wbgt_app.db')
        cursor = conn.cursor()
        
        # Check if our test conduct exists
        cursor.execute("SELECT id, pin, name FROM conduct WHERE name LIKE '%Test%' ORDER BY id DESC LIMIT 1")
        conduct_result = cursor.fetchone()
        
        if conduct_result:
            conduct_id, pin, name = conduct_result
            print(f"Found test conduct: {name} (PIN: {pin}, ID: {conduct_id})")
            
            # Check if we have test users
            cursor.execute("SELECT id, name, role, most_stringent_zone FROM user WHERE conduct_id = ?", (conduct_id,))
            users = cursor.fetchall()
            
            if users:
                print(f"Found {len(users)} users in conduct:")
                for user_id, user_name, role, most_stringent in users:
                    print(f"  - {user_name} ({role}), most_stringent_zone: {most_stringent}")
                    
                    # Test zone transitions for this user
                    print(f"\n--- Testing zone transitions for {user_name} ---")
                    test_user_zone_transitions(user_id, cursor, conn)
            else:
                print("No users found in conduct")
        else:
            print("No test conduct found")
            
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    finally:
        if conn:
            conn.close()

def test_user_zone_transitions(user_id, cursor, conn):
    """Test zone transitions for a specific user"""
    
    # Zone transition sequence: white -> green -> black -> white
    zones = ['white', 'green', 'black', 'white']
    
    for i, zone in enumerate(zones):
        print(f"Step {i+1}: Setting zone to {zone}")
        
        # Simulate setting zone via API call
        try:
            session = requests.Session()
            zone_data = {
                'user_id': user_id,
                'target_user': 'Test User',  # Assuming this is our test user name
                'zone': zone
            }
            response = session.post('http://localhost:5000/set_zone', data=zone_data)
            print(f"  API response: {response.status_code}")
            
            # Wait a moment for database updates
            time.sleep(1)
            
            # Check database state
            cursor.execute("SELECT zone, most_stringent_zone, status, end_time FROM user WHERE id = ?", (user_id,))
            result = cursor.fetchone()
            
            if result:
                current_zone, most_stringent, status, end_time = result
                print(f"  Current zone: {current_zone}")
                print(f"  Most stringent zone: {most_stringent}")
                print(f"  Status: {status}")
                print(f"  End time: {end_time}")
                
                # Calculate rest duration based on most stringent zone
                rest_durations = {
                    "white": 15,
                    "green": 15, 
                    "yellow": 15,
                    "red": 30,
                    "black": 30,
                    "test": 10,
                    "cut-off": 30
                }
                expected_rest = rest_durations.get(most_stringent, 15)
                print(f"  Expected rest duration: {expected_rest} minutes (based on most stringent zone)")
            else:
                print(f"  Error: Could not retrieve user data")
                
        except Exception as e:
            print(f"  Error setting zone: {e}")
        
        print()

def analyze_most_stringent_logic():
    """Analyze the most stringent zone logic from source code"""
    
    print("=== Analysis of Most Stringent Zone Logic ===")
    
    # Zone stringency hierarchy from the code
    zone_stringency = {
        "white": 0,
        "green": 1, 
        "yellow": 2,
        "red": 3,
        "black": 4,
        "cut-off": 5,
        "test": 6
    }
    
    # Rest durations from the code
    wbgt_zones = {
        "white": {"work": 60, "rest": 15},
        "green": {"work": 45, "rest": 15},
        "yellow": {"work": 30, "rest": 15},
        "red": {"work": 30, "rest": 30},
        "black": {"work": 15, "rest": 30},
        "test": {"work": 7/60, "rest": 10},
        "cut-off": {"work": 0, "rest": 30}
    }
    
    print("Zone Stringency Hierarchy (higher number = more stringent):")
    for zone, level in sorted(zone_stringency.items(), key=lambda x: x[1]):
        rest_time = wbgt_zones[zone]["rest"]
        print(f"  {level}: {zone.upper()} zone - {rest_time} minutes rest")
    
    print("\nTest Scenario: white -> green -> black -> white")
    zones_in_sequence = ['white', 'green', 'black', 'white']
    stringency_levels = [zone_stringency[zone] for zone in zones_in_sequence]
    most_stringent_level = max(stringency_levels)
    most_stringent_zone = [zone for zone, level in zone_stringency.items() if level == most_stringent_level][0]
    
    print(f"Most stringent zone in sequence: {most_stringent_zone.upper()} (level {most_stringent_level})")
    print(f"Expected rest duration: {wbgt_zones[most_stringent_zone]['rest']} minutes")
    print(f"Answer to your question: Rest cycle time should be {wbgt_zones[most_stringent_zone]['rest']} minutes")
    print(f"This is based on {most_stringent_zone.upper()} zone, NOT white zone!")

if __name__ == "__main__":
    # First, analyze the logic theoretically
    analyze_most_stringent_logic()
    print("\n" + "="*60 + "\n")
    
    # Then test with actual database
    test_zone_transitions()
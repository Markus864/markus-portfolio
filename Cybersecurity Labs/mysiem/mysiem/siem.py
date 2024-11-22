import os
import re
import time
import json
from datetime import datetime
from collections import defaultdict
import logging
from pathlib import Path

class SimpleSIEM:
    def __init__(self, log_dir="logs", rules_file="rules.json"):
        self.log_dir = log_dir
        self.rules_file = rules_file
        self.alert_count = defaultdict(int)
        self.setup_logging()
        self.load_rules()
        
    def setup_logging(self):
        """Configure logging for the SIEM"""
        logging.basicConfig(
            filename='siem_alerts.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
    
    def load_rules(self):
        """Load detection rules from JSON file"""
        try:
            with open(self.rules_file, 'r') as f:
                self.rules = json.load(f)
        except FileNotFoundError:
            # Default rules if file not found
            self.rules = {
                "ssh_bruteforce": {
                    "pattern": r"Failed password for .* from (.*) port \d+",
                    "threshold": 5,
                    "timeframe": 300,  # 5 minutes
                    "severity": "HIGH"
                },
                "suspicious_commands": {
                    "pattern": r"(wget|curl|nc|netcat|chmod \+x)",
                    "threshold": 1,
                    "timeframe": 60,
                    "severity": "MEDIUM"
                }
            }
    
    def analyze_log_entry(self, line, timestamp):
        """Analyze a single log entry against all rules"""
        alerts = []
        
        for rule_name, rule in self.rules.items():
            matches = re.findall(rule["pattern"], line)
            if matches:
                self.alert_count[rule_name] += 1
                
                if self.alert_count[rule_name] >= rule["threshold"]:
                    alert = {
                        "timestamp": timestamp,
                        "rule_name": rule_name,
                        "severity": rule["severity"],
                        "message": f"Rule '{rule_name}' triggered: {line}",
                        "raw_log": line,
                        "matched_pattern": matches[0] if matches else None
                    }
                    alerts.append(alert)
                    self.generate_alert(alert)
                    
                    # Reset counter after alert
                    self.alert_count[rule_name] = 0
                    
        return alerts

    def generate_alert(self, alert):
        """Generate and log security alert"""
        logging.info(json.dumps(alert))
        
        # For high severity alerts, could add additional actions
        if alert["severity"] == "HIGH":
            logging.warning(f"HIGH SEVERITY ALERT: {alert['message']}")
            # Could add email notification, SMS, etc.

    def monitor_logs(self):
        """Main monitoring loop"""
        print("Starting SIEM monitoring...")
        
        while True:
            for log_file in Path(self.log_dir).glob("*.log"):
                try:
                    with open(log_file, 'r') as f:
                        # Seek to end of file first time
                        f.seek(0, 2)
                        
                        while True:
                            line = f.readline()
                            if not line:
                                break
                                
                            timestamp = datetime.now().isoformat()
                            self.analyze_log_entry(line, timestamp)
                            
                except Exception as e:
                    logging.error(f"Error processing log file {log_file}: {str(e)}")
            
            time.sleep(1)  # Check for new logs every second

    def add_rule(self, rule_name, pattern, threshold, timeframe, severity):
        """Add a new detection rule"""
        self.rules[rule_name] = {
            "pattern": pattern,
            "threshold": threshold,
            "timeframe": timeframe,
            "severity": severity
        }
        
        # Save updated rules to file
        with open(self.rules_file, 'w') as f:
            json.dump(self.rules, f, indent=4)

if __name__ == "__main__":
    # Example usage
    siem = SimpleSIEM()
    
    # Add custom rule example
    siem.add_rule(
        "root_login_attempt",
        r"Failed password for root from (.*) port \d+",
        3,  # threshold
        300,  # timeframe in seconds
        "HIGH"
    )
    
    # Start monitoring
    siem.monitor_logs()
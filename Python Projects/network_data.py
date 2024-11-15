import pyshark
import pandas as pd

def capture_packets(interface='Ethernet', duration=60):
    # Capture packets on the specified interface for the given duration
    capture = pyshark.LiveCapture(interface=interface)
    capture.sniff(timeout=duration)
    return capture

def extract_data(packets):
    # Initialize lists to store the data
    data = {
        'IP Address': [],
        'MAC Address': [],
        'Device Name': [],
        'Protocol': [],
        'Packet Length': [],
        'Info': []
    }

    for packet in packets:
        # Extract data from each packet
        try:
            ip = packet.ip.src
            mac = packet.eth.src
            device_name = packet.layers[0].layer_name
            protocol = packet.transport_layer
            length = packet.length
            info = packet.info

            # Append data to lists
            data['IP Address'].append(ip)
            data['MAC Address'].append(mac)
            data['Device Name'].append(device_name)
            data['Protocol'].append(protocol)
            data['Packet Length'].append(length)
            data['Info'].append(info)

        except AttributeError:
            # Some packets may not have all the fields, ignore those
            continue

    return data

def save_to_spreadsheet(data, filename='network_data.xlsx'):
    # Convert the data to a DataFrame
    df = pd.DataFrame(data)

    # Save the DataFrame to a spreadsheet
    df.to_excel(filename, index=False)

if __name__ == '__main__':
    # Capture packets from the default network interface for 60 seconds
    packets = capture_packets(interface='eth0', duration=60)
    
    # Extract data from captured packets
    data = extract_data(packets)
    
    # Save the data to a spreadsheet
    save_to_spreadsheet(data, 'C:/Users/splaw/OneDrive/Desktop/NetworkData/Spreadsheets/network_data.xlsx')

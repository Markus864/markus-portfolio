import tkinter as tk
from tkinter import messagebox
import ipaddress

def calculate_subnet():
    cidr_input = cidr_entry.get()

    try:
        # Create an IPv4Network object
        network = ipaddress.IPv4Network(cidr_input, strict=False)

        # Calculate required values for the entered CIDR
        network_address = network.network_address
        broadcast_address = network.broadcast_address
        first_host = network_address + 1
        last_host = broadcast_address - 1
        num_hosts = network.num_addresses - 2  # Exclude network and broadcast addresses
        subnet_mask = network.netmask
        wildcard_mask = network.hostmask

        # Update labels with calculated values
        network_address_label.config(text=str(network_address))
        broadcast_address_label.config(text=str(broadcast_address))
        first_host_label.config(text=str(first_host))
        last_host_label.config(text=str(last_host))
        num_hosts_label.config(text=str(num_hosts))
        subnet_mask_label.config(text=str(subnet_mask))
        wildcard_mask_label.config(text=str(wildcard_mask))

        # Clear the treeview
        for item in subnet_table.get_children():
            subnet_table.delete(item)

        # Display other subnet masks
        display_other_subnets(ipaddress.IPv4Address(network.network_address))

    except ValueError as e:
        messagebox.showerror("Invalid Input", f"Error: {e}")

def display_other_subnets(ip):
    # Define a range of CIDR notations to display
    cidr_range = range(1, 32)
    for cidr in cidr_range:
        try:
            network = ipaddress.IPv4Network(f"{ip}/{cidr}", strict=False)
            network_address = network.network_address
            broadcast_address = network.broadcast_address
            num_hosts = network.num_addresses - 2  # Exclude network and broadcast addresses
            subnet_mask = network.netmask

            # Insert into the table
            subnet_table.insert('', 'end', values=(
                f"/{cidr}",
                str(subnet_mask),
                str(network_address),
                str(broadcast_address),
                num_hosts if num_hosts > 0 else 0
            ))
        except Exception as e:
            continue

# Create the main application window
root = tk.Tk()
root.title("IP Subnetting Calculator")

# IP Address in CIDR notation input
tk.Label(root, text="IP Address (CIDR notation):").grid(row=0, column=0, padx=10, pady=5, sticky='e')
cidr_entry = tk.Entry(root)
cidr_entry.grid(row=0, column=1, padx=10, pady=5)

# Calculate Button
calculate_button = tk.Button(root, text="Calculate", command=calculate_subnet)
calculate_button.grid(row=1, column=0, columnspan=2, pady=10)

# Results Labels
tk.Label(root, text="Subnet Mask:").grid(row=2, column=0, padx=10, pady=5, sticky='e')
subnet_mask_label = tk.Label(root, text="")
subnet_mask_label.grid(row=2, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="Wildcard Mask:").grid(row=3, column=0, padx=10, pady=5, sticky='e')
wildcard_mask_label = tk.Label(root, text="")
wildcard_mask_label.grid(row=3, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="Network Address:").grid(row=4, column=0, padx=10, pady=5, sticky='e')
network_address_label = tk.Label(root, text="")
network_address_label.grid(row=4, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="Broadcast Address:").grid(row=5, column=0, padx=10, pady=5, sticky='e')
broadcast_address_label = tk.Label(root, text="")
broadcast_address_label.grid(row=5, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="First Host:").grid(row=6, column=0, padx=10, pady=5, sticky='e')
first_host_label = tk.Label(root, text="")
first_host_label.grid(row=6, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="Last Host:").grid(row=7, column=0, padx=10, pady=5, sticky='e')
last_host_label = tk.Label(root, text="")
last_host_label.grid(row=7, column=1, padx=10, pady=5, sticky='w')

tk.Label(root, text="Number of Usable Hosts:").grid(row=8, column=0, padx=10, pady=5, sticky='e')
num_hosts_label = tk.Label(root, text="")
num_hosts_label.grid(row=8, column=1, padx=10, pady=5, sticky='w')

# Table for other subnet masks
from tkinter import ttk

tk.Label(root, text="Other Subnet Masks:").grid(row=9, column=0, columnspan=2, pady=10)

columns = ('CIDR', 'Subnet Mask', 'Network Address', 'Broadcast Address', 'Usable Hosts')
subnet_table = ttk.Treeview(root, columns=columns, show='headings')
for col in columns:
    subnet_table.heading(col, text=col)
    subnet_table.column(col, width=130)
subnet_table.grid(row=10, column=0, columnspan=2, padx=10, pady=5)

# Run the application
root.mainloop()

# Python Projects

A collection of Python projects and scripts covering automation, web scraping, networking, security, and more.

---

## Automation & Tools

### [Automated Scheduled Call Reminders](./Automated%20Scheduled%20Call%20Reminders/)
Reads scheduled call entries from a Firebase Firestore database and automatically places reminder phone calls via the Twilio API 5 minutes before each scheduled time. A blocking APScheduler job reruns the check every hour.

**Tech:** Python · Twilio · Firebase Admin SDK · APScheduler  
**Files:** `caller.py` (core logic), `schedular.py` (scheduler runner)

---

### [Downloads Organizer](./Downloaded%20Files%20Organizer/)
Monitors active browser processes (Chrome, Firefox, Edge, IE) and watches the downloads directory using the `watchdog` library. When a new file is detected, it is automatically moved into a categorized subfolder based on its extension (image, video, audio, document, archive, code, etc.).

**Tech:** Python · watchdog · psutil  
**Files:** `browser_status.py` (entry point), `obs.py` (folder watcher), `move_to_directory.py` (file sorter)

---

### [Duplicate File Remover](./remove_duplicates.py)
Recursively scans a folder, computes a SHA-256 hash for every file, identifies duplicates, and removes them after user confirmation.

**Tech:** Python · hashlib · os

---

### [Table Extractor from PDF / DOCX / TXT](./Extract-Table-from-pdf-txt-docx/)
Traverses a nested directory structure (Parent → Child1/2/3) and extracts tabular data from PDF files (via tabula), Word documents (via python-docx), and CSV/text files (via pandas).

**Tech:** Python · pandas · tabula-py · python-docx

---

## Web Scraping & APIs

### [Weather Scraper](./Weather%20Scrapper/)
Takes city and state input, navigates Weather Underground using a headless Chrome browser, and scrapes current temperature, precipitation, wind speed, and sky conditions. Results are appended to `weather.csv`.

**Tech:** Python · Selenium · ChromeDriver · csv  
**Run:** `python weather.py`

---

### [Google Image Downloader](./Google_Image_Downloader/)
Interactive menu-driven tool with two modes:
- Search and download images from Google Images by keyword
- Download 1080p wallpapers from wallpaperscraft.com by keyword

**Tech:** Python · BeautifulSoup · requests · urllib

---

### [Image Downloader](./ImageDownloader/)
Fetches a webpage, parses all `<img>` tag `src` attributes, and downloads every image using `wget`.

**Tech:** Python · requests · re

---

### [Daily Horoscope](./daily_horoscope.py)
Scrapes the daily horoscope from horoscope.com for a chosen zodiac sign and day (yesterday/today/tomorrow). Includes a birth-date calculator to determine your sign if unknown.

**Tech:** Python · BeautifulSoup · requests

---

### [Currency Converter](./currency%20converter/)
Desktop GUI currency converter. Select two currencies from dropdown menus, enter an amount, and get the converted value via a live exchange rate API. Built with a PyQt5 UI loaded from a `.ui` file.

**Tech:** Python · PyQt5 · BeautifulSoup · requests  
**Run:** `python main.py`

---

## Networking & Security

### [Network Data Capture](./network_data.py)
Captures live packets from a network interface using pyshark (a Python wrapper for tshark/Wireshark), extracts source IP, MAC address, device name, protocol, and packet length, then exports everything to an Excel spreadsheet.

**Tech:** Python · pyshark · pandas  
**Run:** `python network_data.py` *(requires tshark/Wireshark installed)*

---

### [Port Scanner](./portscanner.py)
Multi-threaded TCP port scanner. Resolves the target hostname to an IP, then spawns a thread per port to attempt a connection and report open/closed status.

**Tech:** Python · socket · threading  
**Run:** `python portscanner.py -H <host> -p <port1,port2,...>`

---

### [Nmap Scanner](./nmap_scan.py)
CLI wrapper around `python-nmap` for scanning TCP port states on a target host.

**Tech:** Python · nmap · optparse  
**Run:** `python nmap_scan.py -H <host> -p <port>`

---

### [NSLookup Checker](./nslookup_check.py)
Reads a list of server hostnames from `server_list.txt` and performs an `nslookup` on each to verify DNS entries.

**Tech:** Python · subprocess

---

## Security & Passwords

### [Password Generator — Advanced](./Password%20Generator/)
Cryptographically secure password generator using Python's `secrets` module. Configurable character set (lowercase, uppercase, digits, punctuation) with an interactive CLI. Enter a length to generate, or toggle character groups by name.

**Tech:** Python · secrets · string  
**Run:** `python pass_gen.py`

---

### [Password Generator — Memorable](./passwordGenerator.py)
Generates human-readable passwords in the format `color + number + ANIMAL + symbol` (e.g. `blue42FALCON!`). Good for passwords that need to be memorized.

**Tech:** Python · random

---

### [QR Code Generator](./QR_code_generator/)
Converts any text or URL to a QR code PNG file.

**Tech:** Python · pyqrcode · png  
**Run:** `python qrcode.py`

---

## Games

### [Snake](./snake.py)
Terminal-based Snake game using the `curses` library. Arrow keys to move, space to pause, ESC to quit. Speed increases as the snake grows. Tracks and persists the high score.

**Run:** `python snake.py`

---

### [Tic Tac Toe](./TicTacToe.py)
Two-player Tic Tac Toe played in the terminal.

---

### [Rock Paper Scissors](./rock_paper_scissor_game.py)
Player vs. computer. Uses modular arithmetic for win/loss/draw detection.

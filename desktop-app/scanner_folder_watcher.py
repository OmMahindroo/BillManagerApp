"""
Scanner Hot-Folder Watcher for Desktop / Laptop
-----------------------------------------------
This Python daemon monitors a local folder (e.g., your scanner output folder)
and automatically notifies you or processes newly intercepted bill scans.

Usage:
    python scanner_folder_watcher.py [WATCH_DIR]

Example:
    python scanner_folder_watcher.py ./scans
"""

import sys
import os
import time
import glob
from pathlib import Path

DEFAULT_WATCH_DIR = os.path.join(os.path.dirname(__file__), "scans")

def ensure_watch_folder(folder_path):
    os.makedirs(folder_path, exist_ok=True)
    print(f"[*] Monitoring hot-folder for new bill scans: {os.path.abspath(folder_path)}")
    print("[*] Tip: Whenever your flatbed or feeder scanner saves an image here, it will be intercepted!")
    print("[*] Press Ctrl + C to exit.\n")

def watch_folder(folder_path):
    ensure_watch_folder(folder_path)
    known_files = set(glob.glob(os.path.join(folder_path, "*.*")))

    try:
        while True:
            time.sleep(1.5)
            current_files = set(glob.glob(os.path.join(folder_path, "*.*")))
            new_files = current_files - known_files

            for new_file in new_files:
                ext = Path(new_file).suffix.lower()
                if ext in [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".bmp", ".tiff"]:
                    print(f"[!] NEW SCAN INTERCEPTED: {os.path.basename(new_file)}")
                    print(f"    Path: {new_file}")
                    print(f"    Size: {os.path.getsize(new_file)} bytes")
                    print("    -> Drag into BillScanner Desktop or upload via 'Browse Files' to parse & append to Excel.\n")
                    
            known_files = current_files
    except KeyboardInterrupt:
        print("\n[*] Scanner folder watcher stopped.")

if __name__ == "__main__":
    watch_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_WATCH_DIR
    watch_folder(watch_path)

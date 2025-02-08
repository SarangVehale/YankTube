import tkinter as tk
from tkinter import ttk, messagebox
import re
from urllib.parse import urlparse
import threading
import time

class YouTubeDownloader:
    def __init__(self, root):
        self.root = root
        self.root.title("🎵 YouTube Downloader Pro 🎥")
        self.root.geometry("600x400")
        self.root.configure(bg="#f0f0f0")
        
        # Main frame
        self.main_frame = ttk.Frame(root, padding="20")
        self.main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Title
        title_label = ttk.Label(
            self.main_frame,
            text="YouTube Downloader Pro",
            font=("Helvetica", 20, "bold")
        )
        title_label.pack(pady=10)
        
        # URL Entry
        self.url_frame = ttk.Frame(self.main_frame)
        self.url_frame.pack(fill=tk.X, pady=10)
        
        self.url_var = tk.StringVar()
        self.url_entry = ttk.Entry(
            self.url_frame,
            textvariable=self.url_var,
            width=50
        )
        self.url_entry.pack(side=tk.LEFT, padx=5)
        
        # Format selection
        self.format_var = tk.StringVar(value="mp4")
        self.format_frame = ttk.Frame(self.main_frame)
        self.format_frame.pack(pady=10)
        
        ttk.Radiobutton(
            self.format_frame,
            text="MP4 Video",
            variable=self.format_var,
            value="mp4"
        ).pack(side=tk.LEFT, padx=10)
        
        ttk.Radiobutton(
            self.format_frame,
            text="MP3 Audio",
            variable=self.format_var,
            value="mp3"
        ).pack(side=tk.LEFT, padx=10)
        
        # Download button
        self.download_btn = ttk.Button(
            self.main_frame,
            text="Download",
            command=self.start_download
        )
        self.download_btn.pack(pady=10)
        
        # Progress bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(
            self.main_frame,
            variable=self.progress_var,
            maximum=100,
            length=400,
            mode='determinate'
        )
        self.progress_bar.pack(pady=10)
        
        # Status label
        self.status_var = tk.StringVar(value="Ready to download!")
        self.status_label = ttk.Label(
            self.main_frame,
            textvariable=self.status_var,
            font=("Helvetica", 10)
        )
        self.status_label.pack(pady=5)

    def validate_url(self, url):
        """Validate YouTube URL"""
        youtube_regex = r'^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/shorts/)[\w-]+(\S+)?$'
        return bool(re.match(youtube_regex, url))

    def simulate_download_progress(self):
        """Simulate download progress (for demonstration)"""
        self.progress_var.set(0)
        self.status_var.set("Starting download...")
        self.download_btn.state(['disabled'])
        
        for i in range(101):
            if i < 20:
                time.sleep(0.05)
            elif i < 80:
                time.sleep(0.02)
            else:
                time.sleep(0.05)
                
            self.progress_var.set(i)
            
            if i == 20:
                self.status_var.set("Extracting video information...")
            elif i == 40:
                self.status_var.set("Processing media...")
            elif i == 60:
                self.status_var.set(f"Downloading as {self.format_var.get().upper()}...")
            elif i == 80:
                self.status_var.set("Finalizing...")
        
        self.status_var.set("Download completed successfully!")
        self.download_btn.state(['!disabled'])
        messagebox.showinfo("Success", "Download completed successfully!")

    def start_download(self):
        """Start the download process"""
        url = self.url_var.get().strip()
        
        if not url:
            messagebox.showerror("Error", "Please enter a URL!")
            return
            
        if not self.validate_url(url):
            messagebox.showerror("Error", "Invalid YouTube URL!")
            return
            
        # Start download in a separate thread to keep UI responsive
        thread = threading.Thread(target=self.simulate_download_progress)
        thread.daemon = True
        thread.start()

def main():
    root = tk.Tk()
    app = YouTubeDownloader(root)
    root.mainloop()

if __name__ =

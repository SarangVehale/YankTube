import os
from yt_dlp import YoutubeDL

# Configuration for yt-dlp
ydl_opts = {
    'format': 'best',  # Download the best quality available
    'outtmpl': 'downloads/%(title)s.%(ext)s',  # Save files in a "downloads" folder
    'noplaylist': True,  # Ensure only single videos are downloaded
    'quiet': True,  # Suppress unnecessary output
}

def download_media(url, format_choice):
    if not os.path.exists("downloads"):
        os.makedirs("downloads")

    if format_choice == "mp4":
        # Download the best video+audio format
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        print("🎥 Download complete! Check the 'downloads' folder.")
    elif format_choice == "mp3":
        # Download the best audio format and convert to MP3
        ydl_opts_audio = ydl_opts.copy()
        ydl_opts_audio.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        })
        with YoutubeDL(ydl_opts_audio) as ydl:
            ydl.download([url])
        print("🎵 Download complete! Check the 'downloads' folder.")
    else:
        print("❌ Invalid format choice.")

def display_menu():
    print("\n" + "=" * 40)
    print("🎥 Welcome to the YouTube Downloader! 🎵")
    print("=" * 40)
    print("1. Download as MP4")
    print("2. Download as MP3")
    print("3. Exit")
    print("=" * 40)

def main():
    while True:
        display_menu()
        choice = input("Enter your choice (1/2/3): ").strip()

        if choice == "1":
            url = input("Enter the YouTube URL: ").strip()
            download_media(url, "mp4")
        elif choice == "2":
            url = input("Enter the YouTube URL: ").strip()
            download_media(url, "mp3")
        elif choice == "3":
            print("👋 Goodbye!")
            break
        else:
            print("❌ Invalid choice. Please try again.")

        input("\nPress Enter to continue...")

if __name__ == "__main__":
    main()

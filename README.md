# YouTube Downloader

A modern, feature-rich YouTube video and audio downloader built with React, FastAPI, and Tailwind CSS.

![YouTube Downloader](preview.png)

## Features

- 🎥 Download YouTube videos in MP4 format
- 🎵 Extract audio in MP3 format
- ✂️ Video trimming support
- 📱 Responsive design for all devices
- 🌗 Dark/Light theme
- 📋 Download queue with progress tracking
- 📜 Download history
- 🎮 Intuitive user interface
- 🔒 Secure and rate-limited API
- 📦 Concurrent download handling
- 💫 Quality selection (High/Medium/Low)
- 💾 Offline support with IndexedDB
- 📊 Real-time progress tracking
- ⚙️ Auto-cleanup of old files

## Tech Stack

- **Frontend**
  - React 18
  - TypeScript
  - Tailwind CSS
  - Lucide Icons
  - IndexedDB (Dexie)
  - Vite

- **Backend**
  - FastAPI
  - Python 3.11+
  - yt-dlp
  - Loguru
  - Rate limiting
  - Security middleware

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- pip

### Installation

1. Clone the repository:
```bash
git clone https://github.com/SarangVehale/YankTube.git
cd YankTube
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend

python3 -m venv virtual-env

# For Linux/ MacOS
source virtual-env/bin/activate
# For Windows
virtual-env/Scripts/activate
pip install -r requirements.txt
```

4. Install FFmpeg

Follow the instructions for your operating system:

- **[Windows](Windows.md)**
- **[macOS](MacOS.md)**
- **[Linux](Linux.md)**

### Development

1. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

2. Start the frontend development server:
```bash
npm run dev
```

3. Open http://localhost:5173 in your browser

### Production Build

1. Build the frontend:
```bash
npm run build
```

2. Start the production server:
```bash
cd backend
uvicorn main:app
```

## Security Features

- Rate limiting
- File size restrictions
- URL validation
- Secure headers
- Input sanitization
- CORS protection

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for the YouTube download functionality
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://reactjs.org/) for the frontend framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
```

---


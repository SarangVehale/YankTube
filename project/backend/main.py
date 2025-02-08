from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi_utils.tasks import repeat_every
from pydantic import BaseModel
from yt_dlp import YoutubeDL
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from loguru import logger
import os
from pathlib import Path
import time
import uuid
from datetime import datetime, timedelta
import aiofiles
import json
import shutil

# Configure logging
logger.add(
    "logs/youtube_downloader.log",
    rotation="500 MB",
    retention="10 days",
    level="INFO",
    format="{time:YYYY-MM-DD at HH:mm:ss} | {level} | {message}"
)

app = FastAPI()

# Configure rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, HTTPException(status_code=429, detail="Too many requests"))
app.add_middleware(SlowAPIMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow your frontend (React/Vue/etc.)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
DOWNLOADS_DIR = Path("downloads")
DOWNLOADS_DIR.mkdir(exist_ok=True)
Path("logs").mkdir(exist_ok=True)

# Store download progress
progress_store = {}

class DownloadRequest(BaseModel):
    url: str
    format: str

def download_media(url: str, format_choice: str, download_id: str):
    """
    Download media using yt-dlp with progress tracking.
    """
    try:
        ydl_opts = {
            'format': 'best',  # Download the best quality available
            'outtmpl': str(DOWNLOADS_DIR / f"%(title)s_{download_id}.%(ext)s"),  # Unique filename
            'noplaylist': True,  # Ensure only single videos are downloaded
            'quiet': True,  # Suppress unnecessary output
            'progress_hooks': [lambda d: progress_hook(d, download_id)],  # Track progress
        }

        if format_choice == "mp3":
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })

        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        progress_store[download_id]["status"] = "completed"
        logger.info(f"Download completed for {url} as {format_choice}.")
    except Exception as e:
        progress_store[download_id]["status"] = "failed"
        logger.error(f"Download failed for {url}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def progress_hook(d: dict, download_id: str):
    """
    Track download progress and update progress_store.
    """
    if d["status"] == "downloading":
        progress_store[download_id] = {
            "progress": d.get("_percent_str", "0%"),
            "speed": d.get("_speed_str", "N/A"),
            "status": "downloading"
        }
    elif d["status"] == "finished":
        progress_store[download_id]["status"] = "processing"

@app.get("/api/progress/{download_id}")
async def get_progress(download_id: str):
    """
    Get the current progress of a download.
    """
    return progress_store.get(download_id, {"status": "not found"})

@app.post("/api/download")
@limiter.limit("5/minute")
async def download_video(request: Request, download_request: DownloadRequest):
    """
    Download a YouTube video or extract audio.
    """
    download_id = str(uuid.uuid4())
    progress_store[download_id] = {"status": "initializing"}

    try:
        # Start the download process
        download_media(download_request.url, download_request.format, download_id)

        # Get the downloaded file
        files = list(DOWNLOADS_DIR.glob(f"*{download_id}*"))
        if not files:
            raise HTTPException(status_code=404, detail="File not found after download.")

        file_name = files[0].name
        file_size = files[0].stat().st_size

        # Log metadata
        metadata = {
            "id": download_id,
            "filename": file_name,
            "size": file_size,
            "timestamp": datetime.now().isoformat()
        }
        async with aiofiles.open("logs/downloads.json", "a") as f:
            await f.write(json.dumps(metadata) + "\n")

        return {
            "status": "success",
            "download_id": download_id,
            "filename": file_name,
            "size": file_size
        }
    except Exception as e:
        logger.error(f"Download failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/download/{download_id}")
async def serve_file(download_id: str):
    """
    Serve the downloaded file.
    """
    files = list(DOWNLOADS_DIR.glob(f"*{download_id}*"))
    if not files:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(files[0]), filename=files[0].name, media_type="application/octet-stream")

@app.on_event("startup")
@repeat_every(seconds=3600)
async def cleanup_old_files():
    """
    Delete files older than 24 hours.
    """
    cutoff = datetime.now() - timedelta(hours=24)
    for file in DOWNLOADS_DIR.glob("*"):
        if file.stat().st_mtime < cutoff.timestamp():
            file.unlink()
            logger.info(f"Deleted old file: {file.name}")

# Cleanup downloads directory on startup
@app.on_event("startup")
async def startup_event():
    if DOWNLOADS_DIR.exists():
        shutil.rmtree(str(DOWNLOADS_DIR))
    DOWNLOADS_DIR.mkdir()

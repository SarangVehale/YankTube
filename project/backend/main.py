from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer
from fastapi_utils.tasks import repeat_every
from pydantic import BaseModel, HttpUrl
from yt_dlp import YoutubeDL
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from loguru import logger
import os
from pathlib import Path
import time
import uuid
from datetime import timedelta
import aiofiles
import re
import asyncio
import traceback

# Security configurations
ALLOWED_DOMAINS = ['youtube.com', 'youtu.be', 'm.youtube.com', 'www.youtube.com']
security = HTTPBearer()

# Configure logging
logger.add(
    "logs/youtube_downloader.log",
    rotation="500 MB",
    retention="10 days",
    level="INFO",
    format="{time:YYYY-MM-DD at HH:mm:ss} | {level} | {message}",
    compression="zip"
)

app = FastAPI(
    title="YouTube Downloader API",
    description="A secure API for downloading YouTube videos",
    version="1.0.0"
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type", "Content-Length"],
    max_age=3600
)

app.add_middleware(SlowAPIMiddleware)

# Create temp directory for downloads
TEMP_DIR = Path("temp")
TEMP_DIR.mkdir(exist_ok=True)

# Data models
class VideoRequest(BaseModel):
    url: HttpUrl

class DownloadRequest(VideoRequest):
    format: str
    quality: str

class VideoFormat(BaseModel):
    quality: str
    format: str
    filesize: int

class VideoInfo(BaseModel):
    title: str
    duration: str
    thumbnail: str
    formats: list[VideoFormat]

# Function to sanitize filenames
def sanitize_filename(filename: str) -> str:
    return re.sub(r'[^\w\-_\. ]', '', filename)

# Function to format duration
def format_duration(seconds: int) -> str:
    return str(timedelta(seconds=seconds))

# Fetch available formats for a given video URL
def get_available_formats(video_url):
    ydl_opts = {'quiet': True, 'no_warnings': True}
    with YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
        return [f["format_id"] for f in info.get("formats", [])]

# API Endpoints
@app.post("/api/video-info", response_model=VideoInfo)
@limiter.limit("30/minute")
async def get_video_info(request: Request, video_request: VideoRequest):
    try:
        ydl_opts = {'format': 'best', 'quiet': True, 'no_warnings': True}
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(str(video_request.url), download=False)
            
            formats = []
            for f in info.get('formats', []):
                if f.get('filesize'):
                    formats.append(VideoFormat(
                        quality=f.get('format_note', 'unknown'),
                        format=f.get('ext', 'unknown'),
                        filesize=f.get('filesize', 0)
                    ))
            
            return VideoInfo(
                title=info.get('title', 'Unknown Title'),
                duration=format_duration(info.get('duration', 0)),
                thumbnail=info.get('thumbnail', ''),
                formats=formats
            )
    except Exception as e:
        logger.error(f"Error fetching video info: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/download")
@limiter.limit("5/minute")
async def download_video(request: Request, download_request: DownloadRequest):
    file_id = uuid.uuid4()  # Unique identifier for this download
    temp_path = TEMP_DIR / f"{file_id}"
    try:
        # Fetch available formats for the video
        available_formats = get_available_formats(str(download_request.url))
        
        # Choose an appropriate format based on the request
        format_choice = None
        if download_request.format == "mp4":
            if "22" in available_formats:
                format_choice = "22"
            elif "18" in available_formats:
                format_choice = "18"
            else:
                format_choice = "best"
        elif download_request.format == "mp3":
            format_choice = "bestaudio/best"
        
        if not format_choice:
            raise HTTPException(status_code=400, detail="No valid format available for this video")
        
        # Build yt-dlp options with an output template that includes the extension.
        ydl_opts = {
            'format': format_choice,
            'outtmpl': str(temp_path) + ".%(ext)s",
            'quiet': False,         # Enable logging output for debugging
            'no_warnings': False,
            'noplaylist': True,
        }
        
        if download_request.format == 'mp3':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192'
            }]
        
        # Download the video/audio
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(str(download_request.url), download=True)
            title = info.get('title', 'video')
        
        # Look for the downloaded file by globbing for any file matching temp_path.*
        downloaded_files = list(TEMP_DIR.glob(f"{file_id}.*"))
        if not downloaded_files:
            raise HTTPException(status_code=500, detail="Download failed: File not found")
        file_path = downloaded_files[0]
        
        filename = f"{sanitize_filename(title)}.{download_request.format}"
        
        # Stream the file and cleanup after streaming
        async def iterfile():
            async with aiofiles.open(file_path, 'rb') as f:
                while chunk := await f.read(8192):
                    yield chunk
            try:
                file_path.unlink(missing_ok=True)
            except Exception as cleanup_err:
                logger.error(f"Error cleaning up file {file_path}: {str(cleanup_err)}")
        
        content_type = "audio/mpeg" if download_request.format == "mp3" else "video/mp4"
        headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': content_type
        }
        
        return StreamingResponse(iterfile(), headers=headers, media_type=content_type)
    
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        traceback.print_exc()
        # Cleanup any temporary files created for this download
        for file in TEMP_DIR.glob(f"{file_id}*"):
            try:
                file.unlink(missing_ok=True)
            except Exception as cleanup_err:
                logger.error(f"Error cleaning up file {file}: {str(cleanup_err)}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

# Cleanup Task: Remove temp files older than 1 hour
@app.on_event("startup")
@repeat_every(seconds=3600)
async def cleanup_temp_files():
    try:
        cutoff = time.time() - 3600
        for file in TEMP_DIR.glob("*"):
            if file.stat().st_mtime < cutoff:
                file.unlink(missing_ok=True)
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi_utils.tasks import repeat_every
from pydantic import BaseModel, HttpUrl
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
import hashlib
import secrets
from typing import Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor
import humanize
from urllib.parse import urlparse
import re
import io

# Security configurations
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500MB
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
    
    def validate_url(self):
        parsed = urlparse(str(self.url))
        if parsed.netloc not in ALLOWED_DOMAINS:
            raise ValueError("Invalid YouTube URL")
        return True

class DownloadRequest(VideoRequest):
    format: str
    quality: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None

    def validate_format(self):
        if self.format not in ['mp3', 'mp4']:
            raise ValueError("Invalid format")
        return True

    def validate_quality(self):
        if self.quality not in ['high', 'medium', 'low']:
            raise ValueError("Invalid quality")
        return True

class VideoFormat(BaseModel):
    quality: str
    format: str
    filesize: int

class VideoInfo(BaseModel):
    title: str
    duration: str
    thumbnail: str
    formats: List[VideoFormat]

def get_format_quality(format_choice: str, quality: str) -> str:
    if format_choice == 'mp3':
        quality_map = {
            'high': '320',
            'medium': '192',
            'low': '128'
        }
        return quality_map.get(quality, '192')
    else:  # mp4
        quality_map = {
            'high': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'medium': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
            'low': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best'
        }
        return quality_map.get(quality, 'best')

def sanitize_filename(filename: str) -> str:
    return re.sub(r'[^\w\-_\. ]', '', filename)

def format_duration(seconds: int) -> str:
    return str(timedelta(seconds=seconds))

# API endpoints
@app.post("/api/video-info", response_model=VideoInfo)
@limiter.limit("30/minute")
async def get_video_info(request: Request, video_request: VideoRequest):
    try:
        video_request.validate_url()
        
        ydl_opts = {
            'format': 'best',
            'quiet': True,
            'no_warnings': True,
        }
        
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
    try:
        download_request.validate_url()
        download_request.validate_format()
        download_request.validate_quality()
        
        # Generate a unique filename
        file_id = uuid.uuid4()
        temp_path = TEMP_DIR / f"{file_id}"
        
        # Configure yt-dlp options
        ydl_opts = {
            'format': get_format_quality(download_request.format, download_request.quality),
            'outtmpl': str(temp_path),
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
        }

        if download_request.format == 'mp3':
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': get_format_quality('mp3', download_request.quality),
                }],
            })

        # Download the video
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(str(download_request.url), download=True)
            title = info.get('title', 'video')
            
            # Find the downloaded file
            if download_request.format == 'mp3':
                file_path = temp_path.with_suffix('.mp3')
            else:
                file_path = temp_path.with_suffix('.mp4')

            if not file_path.exists():
                raise HTTPException(status_code=500, detail="Download failed")

            # Prepare the response
            filename = f"{sanitize_filename(title)}.{download_request.format}"
            
            # Stream the file
            async def iterfile():
                async with aiofiles.open(file_path, 'rb') as f:
                    while chunk := await f.read(8192):
                        yield chunk
                # Clean up after streaming
                file_path.unlink(missing_ok=True)

            content_type = "video/mp4" if download_request.format == "mp4" else "audio/mpeg"
            headers = {
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Type': content_type
            }

            return StreamingResponse(
                iterfile(),
                headers=headers,
                media_type=content_type
            )

    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")
        # Clean up any temporary files
        for file in TEMP_DIR.glob(f"{file_id}*"):
            file.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=str(e))

# Cleanup task
@app.on_event("startup")
@repeat_every(seconds=3600)  # Run every hour
async def cleanup_temp_files():
    """Clean up temporary files older than 1 hour"""
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
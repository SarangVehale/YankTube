from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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
import uuid
from datetime import datetime, timedelta
import shutil
from typing import Optional, List
import asyncio
from concurrent.futures import ThreadPoolExecutor
import humanize
from urllib.parse import urlparse
import re

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
    version="1.0.0",
    docs_url=None,
    redoc_url=None
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address, default_limits=["100/hour"])
app.state.limiter = limiter

# Middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    security_headers = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'"
    }
    response.headers.update(security_headers)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)
app.add_middleware(SlowAPIMiddleware)

# Directories
DOWNLOADS_DIR = Path("downloads")
TEMP_DIR = Path("temp")
LOG_DIR = Path("logs")

for directory in [DOWNLOADS_DIR, TEMP_DIR, LOG_DIR]:
    directory.mkdir(exist_ok=True)

# Models
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
    filename: Optional[str] = None

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

# Download Manager
class DownloadManager:
    def __init__(self):
        self.active_downloads = {}
        self.download_queue = asyncio.Queue()
        self.max_concurrent = 3
        self.executor = ThreadPoolExecutor(max_workers=self.max_concurrent)

    async def start(self):
        for _ in range(self.max_concurrent):
            asyncio.create_task(self.process_queue())

    async def process_queue(self):
        while True:
            download_id, request = await self.download_queue.get()
            try:
                await self.process_download(download_id, request)
            except Exception as e:
                logger.error(f"Download failed: {str(e)}")
                self.active_downloads[download_id].update({
                    "status": "failed",
                    "error": str(e)
                })
            finally:
                self.download_queue.task_done()

    async def process_download(self, download_id: str, request: DownloadRequest):
        try:
            ydl_opts = self.get_ydl_opts(download_id, request)
            url_str = str(request.url)  # Convert HttpUrl to string
            
            await asyncio.get_event_loop().run_in_executor(
                self.executor,
                self.download_video,
                url_str,
                ydl_opts
            )
            
            self.active_downloads[download_id]["status"] = "completed"
            
        except Exception as e:
            logger.error(f"Download failed: {str(e)}")
            raise

    def download_video(self, url: str, opts: dict):
        with YoutubeDL(opts) as ydl:
            ydl.download([url])

    def get_ydl_opts(self, download_id: str, request: DownloadRequest):
        output_template = str(DOWNLOADS_DIR / f"{download_id}.%(ext)s")
        
        opts = {
            'format': get_format_quality(request.format, request.quality),
            'outtmpl': output_template,
            'noplaylist': True,
            'progress_hooks': [lambda d: self.progress_hook(d, download_id)],
            'max_filesize': MAX_FILE_SIZE,
        }

        if request.format == "mp3":
            opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': get_format_quality('mp3', request.quality),
                }],
            })

        if request.start_time is not None or request.end_time is not None:
            opts['download_ranges'] = lambda info: [[
                request.start_time or 0,
                request.end_time or info['duration']
            ]]

        return opts

    def progress_hook(self, d: dict, download_id: str):
        if download_id not in self.active_downloads:
            return

        if d['status'] == 'downloading':
            try:
                downloaded = d.get('downloaded_bytes', 0)
                total = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0)
                
                if total > 0:
                    progress = (downloaded / total) * 100
                    self.active_downloads[download_id].update({
                        'progress': progress,
                        'speed': f"{humanize.naturalsize(d.get('speed', 0), binary=True)}/s",
                        'eta': str(timedelta(seconds=d.get('eta', 0))),
                        'downloaded': humanize.naturalsize(downloaded, binary=True),
                        'total': humanize.naturalsize(total, binary=True)
                    })
            except Exception as e:
                logger.error(f"Progress update error: {str(e)}")

        elif d['status'] == 'finished':
            self.active_downloads[download_id].update({
                'status': 'processing',
                'progress': 100
            })

download_manager = DownloadManager()

# Utilities
def get_format_quality(format_choice: str, quality: str) -> str:
    quality_map = {
        'mp3': {'high': '320', 'medium': '192', 'low': '128'},
        'mp4': {
            'high': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'medium': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
            'low': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best'
        }
    }
    return quality_map[format_choice].get(quality, 'best')

def sanitize_filename(filename: str) -> str:
    return re.sub(r'[^\w\-_\. ]', '', filename)

def format_duration(seconds: int) -> str:
    return str(timedelta(seconds=seconds))

# Endpoints
@app.post("/api/video-info", response_model=VideoInfo)
@limiter.limit("30/minute")
async def get_video_info(request: Request, video_request: VideoRequest):
    try:
        video_request.validate_url()
        ydl_opts = {'format': 'best', 'quiet': True, 'no_warnings': True}
        
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(str(video_request.url), download=False)
            formats = [
                VideoFormat(
                    quality=f.get('format_note', 'unknown'),
                    format=f.get('ext', 'unknown'),
                    filesize=f.get('filesize', 0)
                ) for f in info.get('formats', []) if f.get('filesize')
            ]
            
            return VideoInfo(
                title=info.get('title', 'Unknown Title'),
                duration=format_duration(info.get('duration', 0)),
                thumbnail=info.get('thumbnail', ''),
                formats=formats
            )
            
    except Exception as e:
        logger.error(f"Video info error: {str(e)}")
        raise HTTPException(400, detail=str(e))

@app.post("/api/download")
@limiter.limit("5/minute")
async def start_download(request: Request, download_request: DownloadRequest):
    try:
        download_request.validate_url()
        download_request.validate_format()
        download_request.validate_quality()
        
        download_id = str(uuid.uuid4())
        download_manager.active_downloads[download_id] = {
            "status": "queued",
            "progress": 0,
            "started_at": datetime.now().isoformat()
        }
        
        await download_manager.download_queue.put((download_id, download_request))
        return {"download_id": download_id, "status": "queued"}
        
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        logger.error(f"Download start error: {str(e)}")
        raise HTTPException(500, detail="Internal server error")

@app.get("/api/progress/{download_id}")
async def get_progress(download_id: str):
    if download_id not in download_manager.active_downloads:
        raise HTTPException(404, detail="Download not found")
    return download_manager.active_downloads[download_id]

@app.get("/api/download/{download_id}")
async def serve_file(download_id: str):
    try:
        download = download_manager.active_downloads.get(download_id)
        if not download or download["status"] != "completed":
            raise HTTPException(400, detail="Download not completed")
        
        files = list(DOWNLOADS_DIR.glob(f"{download_id}.*"))
        if not files or not files[0].is_file():
            raise HTTPException(404, detail="File not found")
            
        return FileResponse(
            files[0],
            filename=files[0].name,
            media_type="audio/mpeg" if files[0].suffix == ".mp3" else "video/mp4"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File serving error: {str(e)}")
        raise HTTPException(500, detail="Internal server error")

# Maintenance
@app.on_event("startup")
@repeat_every(seconds=3600)
async def cleanup_old_files():
    try:
        cutoff = datetime.now() - timedelta(hours=24)
        for file in DOWNLOADS_DIR.glob("*"):
            if file.stat().st_mtime < cutoff.timestamp():
                file.unlink()
                logger.info(f"Cleaned up: {file.name}")
    except Exception as e:
        logger.error(f"Cleanup error: {str(e)}")

@app.on_event("startup")
async def startup_event():
    if DOWNLOADS_DIR.exists():
        shutil.rmtree(DOWNLOADS_DIR, ignore_errors=True)
    DOWNLOADS_DIR.mkdir()
    await download_manager.start()

@app.on_event("shutdown")
async def shutdown_event():
    download_manager.executor.shutdown(wait=True)



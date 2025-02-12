export interface VideoInfo {
  title: string;
  duration: string;
  thumbnail: string;
  fileSize?: string;
  formats?: VideoFormat[];
}

export interface VideoFormat {
  quality: string;
  format: string;
  fileSize: string;
}

export interface DownloadHistory {
  id: string;
  title: string;
  format: string;
  timestamp: string;
  thumbnail?: string;
  duration?: string;
  quality?: string;
}

export interface DownloadQueue {
  id: string;
  url: string;
  format: string;
  quality: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  title?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  autoDownload: boolean;
  maxConcurrentDownloads: number;
  defaultFormat: 'mp3' | 'mp4';
  defaultQuality: 'high' | 'medium' | 'low';
  saveHistory: boolean;
}
import axios from 'axios';
import { VideoInfo, DownloadQueue } from '../types';
import { z } from 'zod';

// Validation schemas
const videoInfoSchema = z.object({
  title: z.string(),
  duration: z.string(),
  thumbnail: z.string().url(),
  formats: z.array(z.object({
    quality: z.string(),
    format: z.string(),
    filesize: z.number()
  })).optional()
});

// API client setup
const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  timeout: 300000, // 5 minutes timeout for large files
  headers: {
    'Content-Type': 'application/json',
  },
  responseType: 'blob', // Important for handling binary data
});

// API functions
export const getVideoInfo = async (url: string): Promise<VideoInfo> => {
  try {
    const { data } = await api.post('/video-info', { url }, {
      responseType: 'json' // Override for this specific request
    });
    const validatedData = videoInfoSchema.parse(data);
    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid response format from server');
    }
    throw error;
  }
};

export const startDownload = async (
  url: string,
  format: string,
  quality: string,
  startTime?: number,
  endTime?: number
): Promise<void> => {
  try {
    const response = await api.post('/download', {
      url,
      format,
      quality,
      start_time: startTime,
      end_time: endTime
    }, {
      responseType: 'blob'
    });
    
    // Get filename from Content-Disposition header
    const contentDisposition = response.headers['content-disposition'];
    let filename = 'download.' + format;
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    }
    
    // Create download URL
    const blob = new Blob([response.data], { 
      type: format === 'mp4' ? 'video/mp4' : 'audio/mpeg' 
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    
  } catch (error) {
    console.error('Download error:', error);
    throw new Error('Failed to download video');
  }
};
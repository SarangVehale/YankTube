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

const downloadResponseSchema = z.object({
  download_id: z.string(),
  status: z.string()
});

const progressResponseSchema = z.object({
  progress: z.number(),
  status: z.string(),
  error: z.string().optional()
});

// API client setup
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 60000, // Increased timeout for large files
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request error:', error);
  return Promise.reject(error);
});

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      return Promise.reject(new Error('Rate limit exceeded. Please try again later.'));
    }
    
    if (error.response?.status === 413) {
      return Promise.reject(new Error('File size too large. Please try a lower quality.'));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. Please try again.'));
    }

    return Promise.reject(error);
  }
);

// API functions
export const getVideoInfo = async (url: string): Promise<VideoInfo> => {
  try {
    const { data } = await api.post('/video-info', { url });
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
): Promise<DownloadQueue> => {
  try {
    const { data } = await api.post('/download', {
      url,
      format,
      quality,
      start_time: startTime,
      end_time: endTime
    });
    const validatedData = downloadResponseSchema.parse(data);
    return {
      id: validatedData.download_id,
      status: validatedData.status,
      url,
      format,
      quality,
      progress: 0
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid response format from server');
    }
    throw error;
  }
};

export const getDownloadProgress = async (id: string): Promise<number> => {
  try {
    const { data } = await api.get(`/progress/${id}`);
    const validatedData = progressResponseSchema.parse(data);
    
    if (validatedData.error) {
      throw new Error(validatedData.error);
    }
    
    return validatedData.progress;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error('Invalid progress data from server');
    }
    throw error;
  }
};

export const getDownloadFile = async (id: string): Promise<Blob> => {
  try {
    const { data } = await api.get(`/download/${id}`, {
      responseType: 'blob',
      timeout: 300000, // 5 minutes timeout for large files
    });
    return data;
  } catch (error) {
    throw new Error('Failed to download file');
  }
};
import axios from 'axios';
import { VideoInfo, DownloadQueue } from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if needed
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 429) {
      // Handle rate limiting
      return Promise.reject(new Error('Too many requests. Please try again later.'));
    }
    return Promise.reject(error);
  }
);

export const getVideoInfo = async (url: string): Promise<VideoInfo> => {
  const { data } = await api.post('/video-info', { url });
  return data;
};

export const startDownload = async (
  url: string,
  format: string,
  quality: string
): Promise<DownloadQueue> => {
  const { data } = await api.post('/download', { url, format, quality });
  return data;
};

export const getDownloadProgress = async (id: string): Promise<number> => {
  const { data } = await api.get(`/progress/${id}`);
  return data.progress;
};

export const getDownloadFile = async (id: string): Promise<Blob> => {
  const { data } = await api.get(`/download/${id}`, {
    responseType: 'blob',
  });
  return data;
};
import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Music,
  Video,
  Youtube,
  Settings,
  History,
  Trash2,
  Moon,
  Sun,
  Share2,
  Scissors,
  List,
  X,
  Play,
  Pause,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { db } from './utils/db';
import { getVideoInfo, startDownload } from './utils/api';
import type { VideoInfo, DownloadHistory, DownloadQueue, AppSettings } from './types';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-500 hover:underline"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
  </div>
);

function App() {
  // State
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp4');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistory[]>([]);
  const [downloadQueue, setDownloadQueue] = useState<DownloadQueue[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    autoDownload: true,
    maxConcurrentDownloads: 3,
    defaultFormat: 'mp4',
    defaultQuality: 'high',
    saveHistory: true
  });

  // Video trimming
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number | null>(null);

  // Enhanced error handling
  const handleError = useCallback((error: Error) => {
    console.error('Application error:', error);
    setError(error.message);
    toast.error(error.message);
  }, []);

  // Enhanced form validation
  const validateUrl = useCallback((url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return ['youtube.com', 'youtu.be'].some(domain => 
        urlObj.hostname.includes(domain)
      );
    } catch {
      return false;
    }
  }, []);

  // Load settings and history
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedSettings = await db.settings.toArray();
        if (savedSettings.length > 0) {
          setSettings(savedSettings[0]);
          setTheme(savedSettings[0].theme);
        }

        const history = await db.downloadHistory
          .orderBy('timestamp')
          .reverse()
          .limit(50)
          .toArray();
        setDownloadHistory(history);

        const queue = await db.downloadQueue
          .where('status')
          .notEqual('completed')
          .toArray();
        setDownloadQueue(queue);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };

    loadData();
  }, []);

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Video info fetching
  useEffect(() => {
    const fetchVideoInfo = async () => {
      if (!url) {
        setVideoInfo(null);
        return;
      }

      try {
        const info = await getVideoInfo(url);
        setVideoInfo(info);
        setError(null);

        // Set end time for trimmer
        if (info.duration) {
          const [minutes, seconds] = info.duration.split(':').map(Number);
          setEndTime(minutes * 60 + seconds);
        }
      } catch (err) {
        setVideoInfo(null);
        setError('Invalid YouTube URL');
      }
    };

    const debounceTimer = setTimeout(fetchVideoInfo, 500);
    return () => clearTimeout(debounceTimer);
  }, [url]);

  // Enhanced submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateUrl(url)) {
      handleError(new Error('Please enter a valid YouTube URL'));
      return;
    }

    try {
      setIsLoading(true);
      
      await startDownload(url, format, quality, startTime, endTime);
      
      if (settings.saveHistory && videoInfo) {
        const historyItem: DownloadHistory = {
          id: uuidv4(),
          title: videoInfo.title,
          format,
          timestamp: new Date().toISOString(),
          thumbnail: videoInfo.thumbnail,
          duration: videoInfo.duration,
          quality
        };
        
        await db.downloadHistory.add(historyItem);
        setDownloadHistory(prev => [historyItem, ...prev]);
      }
      
      toast.success('Download started');
      setUrl('');
      setVideoInfo(null);
      setShowTrimmer(false);
      
    } catch (err) {
      handleError(err instanceof Error ? err : new Error('Failed to start download'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'YouTube Downloader',
        text: 'Check out this YouTube video downloader!',
        url: window.location.href
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const clearHistory = async () => {
    try {
      await db.downloadHistory.clear();
      setDownloadHistory([]);
      toast.success('Download history cleared');
    } catch (err) {
      toast.error('Failed to clear history');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setSettings(prev => ({ ...prev, theme: newTheme }));
    db.settings.put({ ...settings, theme: newTheme });
  };

  // Enhanced UI Components
  const VideoPreview = ({ info }: { info: VideoInfo }) => (
    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow-inner">
      <div className="flex items-center gap-4">
        {info.thumbnail && (
          <img
            src={info.thumbnail}
            alt={info.title}
            className="w-24 h-24 object-cover rounded-lg shadow-md"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 truncate">
            {info.title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Duration: {info.duration}
          </p>
          {info.formats && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Available in {info.formats.length} formats
            </p>
          )}
        </div>
      </div>
      
      <button
        type="button"
        onClick={() => setShowTrimmer(!showTrimmer)}
        className="mt-4 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
      >
        <Scissors className="w-4 h-4" />
        {showTrimmer ? 'Hide Trimmer' : 'Trim Video'}
      </button>
      
      {showTrimmer && (
        <div className="mt-4 space-y-4 p-4 bg-white dark:bg-gray-600 rounded-lg shadow-inner">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Time (seconds)
            </label>
            <input
              type="number"
              value={startTime}
              onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
              min={0}
              max={endTime || undefined}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Time (seconds)
            </label>
            <input
              type="number"
              value={endTime || ''}
              onChange={(e) => setEndTime(Math.max(startTime, Number(e.target.value)))}
              min={startTime}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-500 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ErrorBoundary>
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gradient-to-br from-red-500 to-purple-600'} transition-colors duration-200`}>
        <Toaster position="top-right" />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl mx-auto backdrop-blur-sm bg-opacity-95">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <Youtube className="w-12 h-12 text-red-500 dark:text-red-400 mr-3" />
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                  YT Downloader
                </h1>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Share"
                >
                  <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setShowQueue(!showQueue)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative"
                  title="Download Queue"
                >
                  <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  {downloadQueue.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {downloadQueue.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Download History"
                >
                  <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Settings"
                >
                  <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? (
                    <Moon className="w-5 h-5 text-gray-600" />
                  ) : (
                    <Sun className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  YouTube URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube URL here..."
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-colors"
                  required
                />
              </div>

              {isLoading ? (
                <LoadingSpinner />
              ) : (
                videoInfo && <VideoPreview info={videoInfo} />
              )}

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setFormat('mp4')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    format === 'mp4'
                      ? 'bg-primary-600 dark:bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Video className="w-5 h-5" />
                  MP4
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('mp3')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
                    format === 'mp3'
                      ? 'bg-primary-600 dark:bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Music className="w-5 h-5" />
                  MP3
                </button>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={!url || isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
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
  Pause
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { db } from './utils/db';
import { getVideoInfo, startDownload, getDownloadProgress } from './utils/api';
import type { VideoInfo, DownloadHistory, DownloadQueue, AppSettings } from './types';

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

  // Download queue processing
  useEffect(() => {
    const processQueue = async () => {
      const activeDownloads = downloadQueue.filter(
        item => item.status === 'downloading'
      );

      if (activeDownloads.length >= settings.maxConcurrentDownloads) {
        return;
      }

      const nextDownload = downloadQueue.find(item => item.status === 'pending');
      if (!nextDownload) {
        return;
      }

      try {
        const response = await startDownload(
          nextDownload.url,
          nextDownload.format,
          nextDownload.quality
        );

        setDownloadQueue(prev =>
          prev.map(item =>
            item.id === nextDownload.id
              ? { ...item, status: 'downloading' }
              : item
          )
        );

        // Start progress tracking
        trackProgress(nextDownload.id);
      } catch (err) {
        console.error('Download failed:', err);
        setDownloadQueue(prev =>
          prev.map(item =>
            item.id === nextDownload.id
              ? { ...item, status: 'failed' }
              : item
          )
        );
      }
    };

    processQueue();
  }, [downloadQueue, settings.maxConcurrentDownloads]);

  // Progress tracking
  const trackProgress = useCallback(async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const progress = await getDownloadProgress(id);
        
        setDownloadQueue(prev =>
          prev.map(item =>
            item.id === id
              ? { ...item, progress, status: progress === 100 ? 'completed' : 'downloading' }
              : item
          )
        );

        if (progress === 100) {
          clearInterval(interval);
          
          // Add to history if enabled
          if (settings.saveHistory) {
            const download = downloadQueue.find(item => item.id === id);
            if (download && videoInfo) {
              const historyItem: DownloadHistory = {
                id,
                title: videoInfo.title,
                format: download.format,
                timestamp: new Date().toISOString(),
                thumbnail: videoInfo.thumbnail,
                duration: videoInfo.duration,
                quality: download.quality
              };
              
              await db.downloadHistory.add(historyItem);
              setDownloadHistory(prev => [historyItem, ...prev]);
            }
          }
        }
      } catch (err) {
        console.error('Error tracking progress:', err);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [downloadQueue, videoInfo, settings.saveHistory]);

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const downloadId = uuidv4();
      const newDownload: DownloadQueue = {
        id: downloadId,
        url,
        format,
        quality,
        status: 'pending',
        progress: 0,
        title: videoInfo?.title
      };

      await db.downloadQueue.add(newDownload);
      setDownloadQueue(prev => [...prev, newDownload]);
      
      setUrl('');
      setVideoInfo(null);
      
      toast.success('Added to download queue');
    } catch (err) {
      setError('Failed to start download');
      toast.error('Failed to start download');
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

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-gradient-to-br from-red-500 to-purple-600'} transition-colors duration-200`}>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <Youtube className="w-12 h-12 text-red-500 dark:text-red-400 mr-3" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-purple-600 dark:from-red-400 dark:to-purple-500 bg-clip-text text-transparent">
                YT Downloader
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Share"
              >
                <Share2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setShowQueue(!showQueue)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Download Queue"
              >
                <List className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg -gray-700 transition"
                title="Download History"
              >
                <History className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
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
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                required
              />
            </div>

            {videoInfo && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-4">
                  {videoInfo.thumbnail && (
                    <img
                      src={videoInfo.thumbnail}
                      alt={videoInfo.title}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                      {videoInfo.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Duration: {videoInfo.duration}
                    </p>
                    {videoInfo.fileSize && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Size: {videoInfo.fileSize}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTrimmer(!showTrimmer)}
                  className="mt-4 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  <Scissors className="w-4 h-4" />
                  {showTrimmer ? 'Hide Trimmer' : 'Trim Video'}
                </button>
                {showTrimmer && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Time (seconds)
                      </label>
                      <input
                        type="number"
                        value={startTime}
                        onChange={(e) => setStartTime(Number(e.target.value))}
                        min={0}
                        max={endTime || undefined}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        End Time (seconds)
                      </label>
                      <input
                        type="number"
                        value={endTime || ''}
                        onChange={(e) => setEndTime(Number(e.target.value))}
                        min={startTime}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormat('mp4')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
                  format === 'mp4'
                    ? 'bg-purple-600 dark:bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Video className="w-5 h-5" />
                MP4
              </button>
              <button
                type="button"
                onClick={() => setFormat('mp3')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
                  format === 'mp3'
                    ? 'bg-purple-600 dark:bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Music className="w-5 h-5" />
                MP3
              </button>
            </div>

            {showSettings && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
                  Quality Settings
                </h3>
                <div className="flex gap-2">
                  {['high', 'medium', 'low'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q as 'high' | 'medium' | 'low')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm capitalize transition ${
                        quality === q
                          ? 'bg-purple-600 dark:bg-purple-500 text-white'
                          : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-500'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.autoDownload}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          autoDownload: e.target.checked,
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Auto-start downloads
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.saveHistory}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          saveHistory: e.target.checked,
                        }))
                      }
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Save download history
                    </span>
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !url}
              className="w-full bg-gradient-to-r from-red-500 to-purple-600 dark:from-red-400 dark:to-purple-500 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download
                </>
              )}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
              {error}
            </div>
          )}

          {/* Download Queue */}
          {showQueue && (
            <div className="mt-6 border-t dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Download Queue
                </h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {downloadQueue.length} items
                </span>
              </div>
              {downloadQueue.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  Queue is empty
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {downloadQueue.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                            {item.title || 'Loading...'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.format.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.quality}
                            </span>
                          </div>
                        </div>
                        {item.status === 'downloading' && (
                          <div className="ml-4 w-24">
                            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full">
                              <div
                                className="h-2 bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                              {item.progress.toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download History */}
          {showHistory && (
            <div className="mt-6 border-t dark:border-gray-700 pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">
                  Download History
                </h3>
                {downloadHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>
              {downloadHistory.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  No downloads yet
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {downloadHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg flex items-center gap-3"
                    >
                      {item.thumbnail && (
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                            {item.format.toUpperCase()}
                          </span>
                          {item.quality && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.quality}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            Supports YouTube videos, Shorts, and Playlists
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import { Download, Music, Video, Youtube } from 'lucide-react';

function App() {
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp4');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Poll for download progress
  useEffect(() => {
    if (!downloadId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/progress/${downloadId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }

        const progressData = await response.json();
        setProgress(progressData.progress);

        if (progressData.status === 'completed') {
          clearInterval(interval);
          setIsLoading(false);
          alert('Download complete! Click OK to download the file.');

          // Trigger file download
          window.location.href = `http://localhost:8000/api/download/${downloadId}`;
        } else if (progressData.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);
          setError('Download failed. Please try again.');
        }
      } catch (err) {
        clearInterval(interval);
        setIsLoading(false);
        setError('Failed to track download progress.');
      }
    }, 1000); // Poll every second

    return () => clearInterval(interval);
  }, [downloadId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setProgress(null);

    try {
      const response = await fetch('http://localhost:8000/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          format,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to download video');
      }

      const data = await response.json();
      setDownloadId(data.download_id); // Set the download ID for progress tracking
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="flex items-center justify-center mb-8">
          <Youtube className="w-12 h-12 text-red-500 mr-3" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-purple-600 bg-clip-text text-transparent">
            YT Downloader
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste YouTube URL here..."
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              required
            />
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setFormat('mp4')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition ${
                format === 'mp4'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Music className="w-5 h-5" />
              MP3
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-red-500 to-purple-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition disabled:opacity-50"
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

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">
            {error}
          </div>
        )}

        {progress !== null && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-semibold text-blue-800">Download Progress</h3>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-blue-700 mt-2">{progress.toFixed(2)}%</p>
          </div>
        )}

        <p className="mt-6 text-sm text-gray-500 text-center">
          Supports YouTube videos and Shorts
        </p>
      </div>
    </div>
  );
}

export default App;

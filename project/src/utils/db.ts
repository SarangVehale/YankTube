import Dexie, { Table } from 'dexie';
import { DownloadHistory, DownloadQueue, AppSettings } from '../types';

export class YTDownloaderDB extends Dexie {
  downloadHistory!: Table<DownloadHistory>;
  downloadQueue!: Table<DownloadQueue>;
  settings!: Table<AppSettings>;

  constructor() {
    super('YTDownloaderDB');
    
    this.version(1).stores({
      downloadHistory: '++id, timestamp',
      downloadQueue: '++id, status',
      settings: '++id'
    });

    // Add hooks for data validation
    this.downloadHistory.hook('creating', (primKey, obj) => {
      obj.timestamp = obj.timestamp || new Date().toISOString();
    });

    this.downloadQueue.hook('creating', (primKey, obj) => {
      obj.progress = obj.progress || 0;
      obj.status = obj.status || 'pending';
    });
  }

  async clearOldDownloads(days: number = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    await this.downloadHistory
      .where('timestamp')
      .below(cutoff.toISOString())
      .delete();
  }

  async cleanupFailedDownloads() {
    await this.downloadQueue
      .where('status')
      .equals('failed')
      .delete();
  }
}

export const db = new YTDownloaderDB();

// Periodic cleanup
setInterval(() => {
  db.clearOldDownloads().catch(console.error);
  db.cleanupFailedDownloads().catch(console.error);
}, 24 * 60 * 60 * 1000); // Run daily
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
  }
}

export const db = new YTDownloaderDB();
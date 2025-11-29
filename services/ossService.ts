
import { OssConfig, AppSettings, Persona, ChatGroup, Favorite, ChangelogEntry, UserProfile } from '../types';

// Declare global OSS if not typed
declare global {
  interface Window {
    OSS: any;
  }
}

export interface GlobalSyncData {
  timestamp: number;
  updatedBy: string;
  appSettings: Partial<AppSettings>; // Contains providerConfigs, activeProvider, etc.
  personas: Persona[];
  users: UserProfile[]; // Sync registered users
}

export interface UserCloudData {
  timestamp: number;
  userId: string;
  chats: ChatGroup[];
  favorites: Favorite[];
  changelogs: ChangelogEntry[];
}

const MAX_RETRY_TIME = 10000; // 10 seconds
const RETRY_INTERVAL = 200; // 200 ms

/**
 * Waits for the Aliyun OSS SDK to load from the CDN.
 */
async function waitForOSS(): Promise<void> {
  if (window.OSS) return;

  const startTime = Date.now();
  // Poll until loaded or timeout
  while (Date.now() - startTime < MAX_RETRY_TIME) {
    if (window.OSS) return;
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
  }
  
  throw new Error('Aliyun OSS SDK failed to load. Please check your network connection.');
}

/**
 * Creates an OSS client using the credentials provided in the settings.
 */
function createOssClient(config: OssConfig) {
  if (!window.OSS) {
    throw new Error('Aliyun OSS SDK not loaded.');
  }

  const { region, accessKeyId, accessKeySecret, bucket } = config;
  
  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    throw new Error('OSS configuration is incomplete.');
  }

  return new window.OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true
  });
}

function getUserBackupPath(config: OssConfig, userId: string): string {
  // Determine base folder from global path
  const globalPath = config.path || 'ai-roundtable/config.json';
  const lastSlashIndex = globalPath.lastIndexOf('/');
  const baseDir = lastSlashIndex !== -1 ? globalPath.substring(0, lastSlashIndex) : 'ai-roundtable';
  
  return `${baseDir}/users/${userId}.json`;
}

/**
 * Uploads current global configuration (Provider settings + Personas + Users) to OSS.
 */
export const uploadGlobalConfig = async (
  settings: AppSettings, 
  personas: Persona[],
  users: UserProfile[],
  uploadedBy: string = 'admin'
): Promise<void> => {
  if (!settings.ossConfig?.enabled) {
    throw new Error('OSS Sync is disabled in settings.');
  }
  
  await waitForOSS();

  const client = createOssClient(settings.ossConfig);
  const path = settings.ossConfig.path || 'ai-roundtable/config.json';

  // Prepare data to sync
  const syncData: GlobalSyncData = {
    timestamp: Date.now(),
    updatedBy: uploadedBy,
    appSettings: {
      providerConfigs: settings.providerConfigs,
      activeProvider: settings.activeProvider,
      geminiModel: settings.geminiModel,
      enableThinking: settings.enableThinking,
      bannedIps: settings.bannedIps,
      // Synced Fields for Profile & Notification
      notificationConfig: settings.notificationConfig,
      userAvatar: settings.userAvatar,
      userName: settings.userName
    },
    personas: personas,
    users: users
  };

  const content = JSON.stringify(syncData, null, 2);
  const blob = new Blob([content], { type: 'application/json' });

  try {
    await client.put(path, blob);
    console.log('Upload success to', path);
  } catch (err) {
    console.error('OSS Upload Failed', err);
    throw err;
  }
};

/**
 * Downloads global configuration from OSS.
 */
export const downloadGlobalConfig = async (
  settings: AppSettings
): Promise<GlobalSyncData | null> => {
  if (!settings.ossConfig?.enabled) {
    return null;
  }

  await waitForOSS();

  const client = createOssClient(settings.ossConfig);
  const path = settings.ossConfig.path || 'ai-roundtable/config.json';

  try {
    // Standard get request
    const result = await client.get(path);
    if (result.content) {
       const text = new TextDecoder('utf-8').decode(result.content);
       return JSON.parse(text) as GlobalSyncData;
    }
    return null;
  } catch (err) {
    // If file doesn't exist (new setup), return null instead of throwing
    if (String(err).includes('NoSuchKey') || String(err).includes('404')) {
      return null;
    }
    console.error('OSS Download Failed', err);
    throw err;
  }
};

/**
 * Uploads User Data (Chats, etc) to OSS
 */
export const uploadUserData = async (
  settings: AppSettings,
  userId: string,
  data: { chats: ChatGroup[], favorites: Favorite[], changelogs: ChangelogEntry[] }
): Promise<void> => {
  if (!settings.ossConfig?.enabled) return;

  await waitForOSS();
  const client = createOssClient(settings.ossConfig);
  const path = getUserBackupPath(settings.ossConfig, userId);

  const cloudData: UserCloudData = {
    timestamp: Date.now(),
    userId,
    ...data
  };

  const content = JSON.stringify(cloudData);
  const blob = new Blob([content], { type: 'application/json' });

  try {
    await client.put(path, blob);
  } catch (err) {
    console.error(`User Data Upload Failed (${userId})`, err);
    throw err;
  }
};

/**
 * Downloads User Data from OSS
 */
export const downloadUserData = async (
  settings: AppSettings,
  userId: string
): Promise<UserCloudData | null> => {
  if (!settings.ossConfig?.enabled) return null;

  await waitForOSS();
  const client = createOssClient(settings.ossConfig);
  const path = getUserBackupPath(settings.ossConfig, userId);

  try {
    const result = await client.get(path);
    if (result.content) {
      const text = new TextDecoder('utf-8').decode(result.content);
      return JSON.parse(text) as UserCloudData;
    }
    return null;
  } catch (err) {
    // Ignore 404 for new users
    if (String(err).includes('NoSuchKey') || String(err).includes('404')) {
      return null;
    }
    console.error(`User Data Download Failed (${userId})`, err);
    throw err;
  }
};

import { OssConfig, AppSettings, Persona } from '../types';

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
}

const MAX_RETRY_TIME = 5000; // 5 seconds
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

/**
 * Uploads current global configuration (Provider settings + Personas) to OSS.
 */
export const uploadGlobalConfig = async (
  settings: AppSettings, 
  personas: Persona[],
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
      // We explicitly exclude sensitive user data or ban lists from basic sync if desired,
      // but usually Banned IPs should be synced by Admin.
      bannedIps: settings.bannedIps
    },
    personas: personas
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
    // Add a random query param to bypass CDN cache if necessary, though OSS SDK handles signature.
    // Standard get request:
    const result = await client.get(path);
    if (result.content) {
       const text = new TextDecoder('utf-8').decode(result.content);
       return JSON.parse(text) as GlobalSyncData;
    }
    return null;
  } catch (err) {
    console.error('OSS Download Failed', err);
    throw err;
  }
};
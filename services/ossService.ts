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

/**
 * Creates an OSS client using the credentials provided in the settings.
 */
function createOssClient(config: OssConfig) {
  if (!window.OSS) {
    throw new Error('Aliyun OSS SDK not loaded. Please check your network or script tags.');
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

  const client = createOssClient(settings.ossConfig);
  const path = settings.ossConfig.path || 'ai-roundtable/config.json';

  // Prepare data to sync
  // We sync Provider Configs, Active Provider, and Personas.
  // We do NOT sync user-specific things like User Name, Avatar, or Banned IPs (unless desired).
  // For this requirement: "Other users can directly use main account's configured models and roles"
  const syncData: GlobalSyncData = {
    timestamp: Date.now(),
    updatedBy: uploadedBy,
    appSettings: {
      providerConfigs: settings.providerConfigs,
      activeProvider: settings.activeProvider,
      geminiModel: settings.geminiModel,
      enableThinking: settings.enableThinking,
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
    // If disabled, we can't sync.
    return null;
  }

  const client = createOssClient(settings.ossConfig);
  const path = settings.ossConfig.path || 'ai-roundtable/config.json';

  try {
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
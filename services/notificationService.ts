import { NotificationConfig } from '../types';

export const sendBarkNotification = async (
  title: string,
  body: string,
  config?: NotificationConfig
) => {
  if (!config || !config.enabled || !config.deviceKey) return;

  let baseUrl = config.serverUrl || 'https://api.day.app';
  // Remove trailing slash if present
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  // Bark API format: https://api.day.app/{key}/{title}/{body}
  // Optional query params: group, icon, sound, etc.
  const url = `${baseUrl}/${config.deviceKey}/${encodeURIComponent(title)}/${encodeURIComponent(body)}?group=AI-RoundTable&icon=https://ui-avatars.com/api/?name=AI&background=07c160&color=fff`;

  try {
    await fetch(url, { method: 'GET' });
    console.log('Bark notification sent:', title);
  } catch (error) {
    console.error('Bark notification failed', error);
  }
};

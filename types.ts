

export interface PersonaConfig {
  provider: ProviderId;
  modelId: string;
}

export interface Persona {
  id: string;
  name: string;
  role: string;
  avatar: string;
  systemInstruction: string;
  color: string;
  config: PersonaConfig; // Configuration specific to this persona
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  isUser: boolean;
  isSystem?: boolean;
}

export interface ChatMemberConfig {
  roleId: string;
  replyCount: number; // How many times they speak per turn
}

export interface ChatGroupConfig {
  memberConfigs: Record<string, ChatMemberConfig>; // Keyed by roleId
  summaryAgentId?: string; // ID of the agent responsible for summaries
  speakingOrder?: string[]; // Array of persona IDs defining the order
  enableRandomOrder?: boolean; // Toggle for randomizing speaking order
}

export interface ChatGroup {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  timestamp?: string;
  unreadCount?: number;
  members: string[]; // List of Persona IDs
  config?: ChatGroupConfig;
  type?: 'group' | 'private'; // Distinguish between group and private chats
  isReadOnly?: boolean; // For displaying favorites or archives
}

export interface Favorite {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  type: 'single' | 'batch' | 'chat'; // Single msg, multiple selected, or whole chat
  preview: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  content: string;
}

export type GeminiModelId = 'gemini-2.5-flash' | 'gemini-3-pro-preview';
export type ProviderId = 'gemini' | 'deepseek' | 'openai' | 'qwen';

export interface ModelOption {
  id: string;
  name: string;
}

export interface ModelProvider {
  id: ProviderId;
  name: string;
  icon: string;
  description: string;
  defaultBaseUrl?: string;
  models: ModelOption[];
  fields: {
    key: 'apiKey' | 'baseUrl';
    label: string;
    placeholder: string;
    type: 'text' | 'password';
  }[];
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  fetchedModels?: ModelOption[]; // Store models fetched from API
}

export interface AppSettings {
  userAvatar: string;
  userName: string;
  geminiModel: GeminiModelId; // Legacy / Fallback
  enableThinking: boolean;
  
  // New Multi-provider support
  activeProvider: ProviderId; // Default/Global provider
  providerConfigs: Record<ProviderId, ProviderConfig>;
  
  // Admin Security
  bannedIps: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  createdAt: number;
  lastIp?: string; // Recorded IP
  isBanned?: boolean; // Explicit ban status
}
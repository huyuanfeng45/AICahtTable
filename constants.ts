import { Persona, ChatGroup, ModelProvider, GeminiModelId, ProviderId, ProviderConfig, ChangelogEntry, AppSettings, MomentPost } from './types';

export const USER_ID = 'user-me';

// Define the AI personalities that will participate in the chat
export const AI_PERSONAS: Persona[] = [
  {
    id: 'expert_tech',
    name: '极客阿伦',
    role: 'Tech Enthusiast',
    avatar: 'https://picsum.photos/seed/tech/200/200',
    color: 'text-blue-600',
    systemInstruction: '你叫极客阿伦。你是一个狂热的技术专家，说话简短直接，喜欢用专业术语。你总是从技术可行性、代码实现或硬件规格的角度分析问题。',
    config: { provider: 'deepseek', modelId: 'deepseek-reasoner' } // Example: Tech guy uses DeepSeek R1
  },
  {
    id: 'expert_creative',
    name: '文艺小雅',
    role: 'Creative Writer',
    avatar: 'https://picsum.photos/seed/art/200/200',
    color: 'text-purple-600',
    systemInstruction: '你叫文艺小雅。你是一个感性、富有想象力的作家。你不在乎技术细节，只在乎美感、情感和用户体验。你的语言优美，喜欢用比喻。',
    config: { provider: 'gemini', modelId: 'gemini-3-pro-preview' } // Creative uses Gemini Pro
  },
  {
    id: 'expert_skeptic',
    name: '杠精老王',
    role: 'Critical Thinker',
    avatar: 'https://picsum.photos/seed/skeptic/200/200',
    color: 'text-orange-700',
    systemInstruction: '你叫杠精老王。你是一个非常挑剔的评论家。你总是能发现别人的逻辑漏洞。你说话尖锐，喜欢反问，经常泼冷水，提醒大家注意风险和陷阱。',
    config: { provider: 'openai', modelId: 'gpt-4o' } // Skeptic uses GPT-4o
  },
  {
    id: 'moderator',
    name: '群主',
    role: 'Moderator',
    avatar: 'https://picsum.photos/seed/mod/200/200',
    color: 'text-green-600',
    systemInstruction: '你是这个群的群主。你的工作是总结大家的发言，维持秩序，并给出客观平衡的结论。你的语气稳重、平和。',
    config: { provider: 'gemini', modelId: 'gemini-2.5-flash' } // Moderator uses Flash for speed
  }
];

export const MOCK_CHATS: ChatGroup[] = [
  {
    id: 'group_main',
    name: 'AI 圆桌会议 (5)',
    avatar: 'https://picsum.photos/seed/group/200/200',
    lastMessage: '群主: 大家都说得很有道理...',
    timestamp: '22:03',
    members: ['expert_tech', 'expert_creative', 'expert_skeptic', 'moderator'],
    config: { 
      memberConfigs: {}, 
      summaryAgentId: 'moderator',
      speakingOrder: ['expert_tech', 'expert_creative', 'expert_skeptic', 'moderator'],
      enableRandomOrder: false
    }
  },
  {
    id: 'group_dev',
    name: '前端开发交流',
    avatar: 'https://picsum.photos/seed/code/200/200',
    lastMessage: 'React 19 什么时候出稳定版？',
    timestamp: '20:45',
    unreadCount: 12,
    members: [],
    config: { memberConfigs: {} }
  },
  {
    id: 'group_news',
    name: '科技新闻速递',
    avatar: 'https://picsum.photos/seed/news/200/200',
    lastMessage: '[链接] 刚刚发布的新模型...',
    timestamp: '19:30',
    members: [],
    config: { memberConfigs: {} }
  },
   {
    id: 'group_random',
    name: '摸鱼闲聊',
    avatar: 'https://picsum.photos/seed/fish/200/200',
    lastMessage: '中午吃什么？',
    timestamp: 'Yesterday',
    members: [],
    config: { memberConfigs: {} }
  }
];

export const MOCK_CHANGELOGS: ChangelogEntry[] = [
  {
    id: 'log_3',
    version: 'v1.5.0',
    date: '2025-05-20',
    title: '多模型混合协作',
    content: '- 新增 DeepSeek R1 和 Qwen Max 模型支持\n- 优化了思考链 (Thinking) 的展示效果\n- 修复了切换会话时的滚动条跳动问题'
  },
  {
    id: 'log_2',
    version: 'v1.2.0',
    date: '2025-05-10',
    title: '收藏夹功能上线',
    content: '- 支持长按消息进行多选收藏\n- 收藏内容支持导出为图片或文本\n- 侧边栏新增收藏箱入口'
  },
  {
    id: 'log_1',
    version: 'v1.0.0',
    date: '2025-04-01',
    title: '初始版本发布',
    content: '- 基础聊天功能\n- 支持 Gemini 2.5 Flash\n- 角色扮演系统上线'
  }
];

export const MOCK_MOMENTS: MomentPost[] = [];

export const GEMINI_MODELS: {id: GeminiModelId; name: string; desc: string}[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: '速度快，响应即时，适合日常对话' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro (Preview)', desc: '推理能力更强，适合复杂分析' },
];

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: 'https://ui-avatars.com/api/?name=GE&background=34a853&color=fff',
    description: '官方原生接入 (或使用代理)',
    models: [
       { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
       { id: 'gemini-3-pro-preview', name: 'Gemini 3.0 Pro' }
    ],
    fields: [
       // Added fields so users can input custom keys/urls if they want (e.g. OpenAI compatible proxy for Gemini)
       { key: 'baseUrl', label: 'Base URL (可选, 用于代理)', placeholder: 'https://generativelanguage.googleapis.com', type: 'text' },
       { key: 'apiKey', label: 'API Key (空则使用环境变量)', placeholder: 'AIza...', type: 'password' }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: 'https://ui-avatars.com/api/?name=DS&background=3b82f6&color=fff',
    description: '接入 DeepSeek V3/R1',
    defaultBaseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)' }
    ],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.deepseek.com', type: 'text' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' }
    ]
  },
  {
    id: 'qwen',
    name: 'Qwen (通义千问)',
    icon: 'https://ui-avatars.com/api/?name=QW&background=615ced&color=fff',
    description: '接入阿里 Qwen 模型 (DashScope)',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      { id: 'qwen-plus', name: 'Qwen Plus' },
      { id: 'qwen-max', name: 'Qwen Max' },
      { id: 'qwen-turbo', name: 'Qwen Turbo' }
    ],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1', type: 'text' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: 'https://ui-avatars.com/api/?name=OA&background=10a37f&color=fff',
    description: '接入 GPT-4o / 4.5',
    defaultBaseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ],
    fields: [
      { key: 'baseUrl', label: 'Base URL', placeholder: 'https://api.openai.com/v1', type: 'text' },
      { key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' }
    ]
  }
];

export const DEFAULT_PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com', selectedModel: 'gemini-2.5-flash' },
  deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', selectedModel: 'deepseek-chat' },
  qwen: { apiKey: '', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', selectedModel: 'qwen-plus' },
  openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', selectedModel: 'gpt-4o' }
};

// Safe environment variable retrieval for Client-Side Bundlers
const getEnv = (key: string): string => {
  // 1. Try Vite's import.meta.env
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
       // @ts-ignore
       const val = import.meta.env[`VITE_${key}`] || import.meta.env[key];
       if (val) return val;
    }
  } catch (e) {}

  // 2. Try process.env (Legacy / Webpack / Vercel System Env injection)
  try {
    if (typeof process !== 'undefined' && process.env) {
       return process.env[`VITE_${key}`] || 
              process.env[`REACT_APP_${key}`] || 
              process.env[key] || 
              '';
    }
  } catch (e) {}

  return '';
};

// Check for Vercel/System Env Vars for OSS
const ENV_OSS_CONFIG = {
  region: getEnv('OSS_REGION'),
  accessKeyId: getEnv('OSS_ACCESS_KEY_ID'),
  accessKeySecret: getEnv('OSS_ACCESS_KEY_SECRET'),
  bucket: getEnv('OSS_BUCKET'),
  path: getEnv('OSS_PATH') || 'ai-roundtable/config.json',
};

// If valid credentials exist in environment, we enable sync by default
const hasEnvOss = !!(ENV_OSS_CONFIG.region && ENV_OSS_CONFIG.accessKeyId && ENV_OSS_CONFIG.accessKeySecret && ENV_OSS_CONFIG.bucket);

export const DEFAULT_APP_SETTINGS: AppSettings = {
  userAvatar: 'https://picsum.photos/seed/me/100/100',
  userName: 'User',
  geminiModel: 'gemini-2.5-flash',
  enableThinking: false,
  maxReplyLength: 200, // Default limit
  activeProvider: 'gemini',
  providerConfigs: DEFAULT_PROVIDER_CONFIGS,
  bannedIps: [],
  ossConfig: {
    ...ENV_OSS_CONFIG,
    enabled: hasEnvOss,
    autoSync: hasEnvOss
  },
  notificationConfig: {
    enabled: false,
    serverUrl: 'https://api.day.app',
    deviceKey: ''
  }
};
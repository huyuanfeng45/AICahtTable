

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ContactList from './components/ContactList';
import FavoritesList from './components/FavoritesList';
import ChangelogList from './components/ChangelogList';
import ChatWindow from './components/ChatWindow';
import ChangelogView from './components/ChangelogView';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import AuthModal from './components/AuthModal';
import { MOCK_CHATS, DEFAULT_PROVIDER_CONFIGS, AI_PERSONAS, MOCK_CHANGELOGS, DEFAULT_APP_SETTINGS } from './constants';
import { AppSettings, Persona, ChatGroup, Favorite, Message, ChangelogEntry, UserProfile } from './types';
import { downloadGlobalConfig, downloadUserData, uploadUserData } from './services/ossService';
import { sendBarkNotification } from './services/notificationService';

const INITIAL_ABOUT_CONTENT = `AI Round Table v1.5.0

主要功能：
- 多模型混合协作 (Gemini, DeepSeek, OpenAI)
- 角色扮演与群聊模拟
- 收藏夹与导出功能
- 实时思维链展示
- 阿里云 OSS 配置同步 (支持 Vercel 环境变量)`;

// Persistence Helper
function loadState<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (e) {
    console.warn(`Error loading ${key}`, e);
    return defaultValue;
  }
}

// Mock IP Generator
const generateMockIp = () => {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
};

const App: React.FC = () => {
  // User Management State
  const [users, setUsers] = useState<UserProfile[]>(() => loadState('app_users', []));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // --- Data State (Dependent on currentUser) ---
  const [chats, setChats] = useState<ChatGroup[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>([]);
  
  // App Settings - Loaded per user (preference) or global default
  const [settings, setSettings] = useState<AppSettings>(() => {
      const global = loadState<Partial<AppSettings>>('app_global_settings', {});
      
      // Determine if we have Environment Variables for OSS
      const envOssConfig = DEFAULT_APP_SETTINGS.ossConfig;
      const hasEnvOss = envOssConfig && envOssConfig.accessKeyId && envOssConfig.bucket;
      
      const mergedSettings: AppSettings = {
          ...DEFAULT_APP_SETTINGS,
          ...global,
          bannedIps: global.bannedIps || [],
          // Preserve User Profile if coming from global cache (legacy) or default
          userName: global.userName || DEFAULT_APP_SETTINGS.userName,
          // Notification config is global/admin
          notificationConfig: global.notificationConfig || DEFAULT_APP_SETTINGS.notificationConfig
      };
      
      // CRITICAL: Force OSS Config from Environment if present
      if (hasEnvOss) {
          mergedSettings.ossConfig = {
              ...mergedSettings.ossConfig,
              region: envOssConfig.region,
              accessKeyId: envOssConfig.accessKeyId,
              accessKeySecret: envOssConfig.accessKeySecret,
              bucket: envOssConfig.bucket,
              path: envOssConfig.path,
              // Force enabled/autoSync to true if Environment Variables exist
              // This guarantees "Open webpage automatically connect" regardless of previous local saves
              enabled: true,
              autoSync: true,
          };
      } else {
          mergedSettings.ossConfig = global.ossConfig || DEFAULT_APP_SETTINGS.ossConfig;
      }
      
      return mergedSettings;
  });
  
  // Selection State
  const [selectedChatId, setSelectedChatId] = useState('');
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [aboutContent, setAboutContent] = useState(INITIAL_ABOUT_CONTENT);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chats' | 'contacts' | 'favorites' | 'changelog'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<string>(''); // For AuthModal feedback
  const [ossConnectStatus, setOssConnectStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

  // Admin Auth (for global settings)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: '123456' });

  // Manage Personas State (Global for now, but editable)
  const [personas, setPersonas] = useState<Persona[]>(() => loadState('app_personas', AI_PERSONAS));

  // Determine if Config is present (for UI feedback)
  const isOssConfigured = !!(settings.ossConfig?.accessKeyId && settings.ossConfig?.bucket);

  // Ref for debounced save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Auto Sync Logic (Global Config) ---
  useEffect(() => {
      const performAutoSync = async () => {
          if (settings.ossConfig?.enabled && settings.ossConfig?.autoSync) {
              setSyncStatus('正在连接云端数据库...');
              setOssConnectStatus('connecting');
              try {
                  const data = await downloadGlobalConfig(settings);
                  setOssConnectStatus('connected');
                  if (data) {
                      console.log('Auto-sync successful', data);
                      setSyncStatus('配置同步成功');
                      
                      const newSettings = {
                          ...settings,
                          providerConfigs: data.appSettings.providerConfigs || settings.providerConfigs,
                          activeProvider: data.appSettings.activeProvider || settings.activeProvider,
                          geminiModel: data.appSettings.geminiModel || settings.geminiModel,
                          enableThinking: data.appSettings.enableThinking ?? settings.enableThinking,
                          bannedIps: data.appSettings.bannedIps || settings.bannedIps,
                          notificationConfig: data.appSettings.notificationConfig || settings.notificationConfig
                      };
                      setSettings(newSettings);
                      
                      // Update Personas
                      if (data.personas) {
                          setPersonas(data.personas);
                          localStorage.setItem('app_personas', JSON.stringify(data.personas));
                      }
                      
                      // Update Users Registry from Cloud (For Admin Management)
                      if (data.users && Array.isArray(data.users)) {
                          // Merge Strategy: Keep local new users not yet synced, update existing
                          // For simplicity, we prioritize Cloud list but try to preserve any local-only user if ID not present?
                          // Given this is an Admin centric feature, typically Cloud overwrites local registry to keep consistency.
                          setUsers(data.users);
                          localStorage.setItem('app_users', JSON.stringify(data.users));
                      }
                      
                      // Persist merged state to local storage
                      const configToSave = {
                          providerConfigs: newSettings.providerConfigs,
                          activeProvider: newSettings.activeProvider,
                          geminiModel: newSettings.geminiModel,
                          enableThinking: newSettings.enableThinking,
                          bannedIps: newSettings.bannedIps,
                          ossConfig: settings.ossConfig, // Persist OSS toggle state
                          notificationConfig: newSettings.notificationConfig
                      };
                      localStorage.setItem('app_global_settings', JSON.stringify(configToSave));
                      
                      // Clear status after delay
                      setTimeout(() => setSyncStatus(''), 2000);
                  } else {
                      setSyncStatus(''); // Silent if empty
                  }
              } catch (e) {
                  console.error('Auto-sync failed', e);
                  setSyncStatus('云端同步失败 (请检查网络或配置)');
                  setOssConnectStatus('error');
                  setTimeout(() => setSyncStatus(''), 5000);
              }
          }
      };
      
      // Run once on mount if enabled
      performAutoSync();
  }, []); // Only run once on mount

  // --- Effects for User Switching & Data Loading ---

  // Load user-specific data when currentUser changes
  useEffect(() => {
      if (currentUser) {
          // 1. Load from LocalStorage first (Instant interaction)
          setChats(loadState(`app_chats_${currentUser.id}`, MOCK_CHATS));
          setFavorites(loadState(`app_favorites_${currentUser.id}`, []));
          setChangelogs(loadState(`app_changelogs_${currentUser.id}`, MOCK_CHANGELOGS));
          
          // 2. Load Settings
          const savedUserSettings = loadState<AppSettings | null>(`app_settings_${currentUser.id}`, null);
          const savedGlobalSettings = loadState<Partial<AppSettings>>('app_global_settings', {});
          
          // Determine Env OSS Config
          const envOssConfig = DEFAULT_APP_SETTINGS.ossConfig;
          const hasEnvOss = envOssConfig && envOssConfig.accessKeyId && envOssConfig.bucket;

          const mergedSettings: AppSettings = {
              ...DEFAULT_APP_SETTINGS,
              ...savedUserSettings,
              providerConfigs: savedGlobalSettings.providerConfigs || (savedUserSettings?.providerConfigs || DEFAULT_APP_SETTINGS.providerConfigs),
              activeProvider: savedGlobalSettings.activeProvider || (savedUserSettings?.activeProvider || DEFAULT_APP_SETTINGS.activeProvider),
              geminiModel: savedGlobalSettings.geminiModel || (savedUserSettings?.geminiModel || DEFAULT_APP_SETTINGS.geminiModel),
              enableThinking: savedGlobalSettings.enableThinking ?? (savedUserSettings?.enableThinking ?? DEFAULT_APP_SETTINGS.enableThinking),
              bannedIps: savedGlobalSettings.bannedIps || [],
              ossConfig: hasEnvOss ? {
                  ...envOssConfig,
                  enabled: true,
                  autoSync: true,
              } : (savedGlobalSettings.ossConfig || (savedUserSettings?.ossConfig || DEFAULT_APP_SETTINGS.ossConfig)),
              notificationConfig: savedGlobalSettings.notificationConfig || DEFAULT_APP_SETTINGS.notificationConfig,
              userName: savedUserSettings?.userName || currentUser.name,
              userAvatar: savedUserSettings?.userAvatar || currentUser.avatar,
          };
          
          setSettings(mergedSettings);

          // 3. Cloud Sync: Attempt to download User Data from OSS if enabled
          if (mergedSettings.ossConfig?.enabled && mergedSettings.ossConfig?.autoSync) {
              setSyncStatus('正在同步个人数据...');
              downloadUserData(mergedSettings, currentUser.id).then(cloudData => {
                  if (cloudData) {
                      console.log('User data loaded from cloud', cloudData);
                      // Merge strategy: Cloud overwrite local if exists
                      if(cloudData.chats) setChats(cloudData.chats);
                      if(cloudData.favorites) setFavorites(cloudData.favorites);
                      if(cloudData.changelogs) setChangelogs(cloudData.changelogs);
                      setSyncStatus('数据已同步');
                  } else {
                      setSyncStatus('');
                  }
                  setTimeout(() => setSyncStatus(''), 2000);
              }).catch(e => {
                  console.error('User data sync failed', e);
                  setSyncStatus('数据同步失败');
              });
          }

          // Reset selection
          setSelectedChatId('');
          setSelectedFavoriteId(null);
          setSelectedLogId(null);
          setActiveSidebarTab('chats');
      }
  }, [currentUser]);

  // --- Auto-Save User Data Logic (Debounced) ---
  useEffect(() => {
    // Only save if user logged in and OSS enabled
    if (currentUser && settings.ossConfig?.enabled) {
        // Clear previous timeout
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        // Debounce 3 seconds
        saveTimeoutRef.current = setTimeout(() => {
            console.log('Auto-saving user data to cloud...');
            // setSyncStatus('正在保存...');
            uploadUserData(settings, currentUser.id, {
                chats,
                favorites,
                changelogs
            }).then(() => {
                // setSyncStatus('已保存到云端');
                // setTimeout(() => setSyncStatus(''), 2000);
            }).catch(e => {
                console.error("Auto save failed", e);
            });
        }, 3000);
    }
    
    return () => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [chats, favorites, changelogs, currentUser, settings.ossConfig?.enabled]);


  // Persist Users List
  useEffect(() => { localStorage.setItem('app_users', JSON.stringify(users)); }, [users]);
  
  // Persist Global Personas
  useEffect(() => { localStorage.setItem('app_personas', JSON.stringify(personas)); }, [personas]);

  // Persist User-Specific Data (Local)
  useEffect(() => { 
      if(currentUser) localStorage.setItem(`app_chats_${currentUser.id}`, JSON.stringify(chats)); 
  }, [chats, currentUser]);

  useEffect(() => { 
      if(currentUser) localStorage.setItem(`app_favorites_${currentUser.id}`, JSON.stringify(favorites)); 
  }, [favorites, currentUser]);

  useEffect(() => { 
      if(currentUser) localStorage.setItem(`app_changelogs_${currentUser.id}`, JSON.stringify(changelogs)); 
  }, [changelogs, currentUser]);
  
  useEffect(() => { 
      if(currentUser) localStorage.setItem(`app_settings_${currentUser.id}`, JSON.stringify(settings)); 
  }, [settings, currentUser]);


  // --- Handlers ---

  const handleRegister = (name: string) => {
      const mockIp = generateMockIp();
      
      // Check Ban
      const globalSettings = loadState<Partial<AppSettings>>('app_global_settings', {});
      const banned = globalSettings.bannedIps || [];
      if (banned.includes(mockIp)) {
          alert("禁止访问：您的 IP 地址已被封禁。");
          return;
      }

      const newUser: UserProfile = {
          id: `u_${Date.now()}`,
          name: name,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
          createdAt: Date.now(),
          lastIp: mockIp
      };
      setUsers(prev => [...prev, newUser]);
      setCurrentUser(newUser);

      // Trigger Notification (Bark)
      if (settings.notificationConfig?.enabled) {
          sendBarkNotification(
            '新用户注册 (New User)', 
            `用户 "${name}" 已注册。\nIP: ${mockIp}`, 
            settings.notificationConfig
          );
      }
  };

  const handleLogin = (user: UserProfile) => {
      // Check Ban (Check user's last recorded IP)
      const globalSettings = loadState<Partial<AppSettings>>('app_global_settings', {});
      const banned = globalSettings.bannedIps || [];
      
      if (user.lastIp && banned.includes(user.lastIp)) {
          alert(`登录失败：账号关联的 IP (${user.lastIp}) 已被封禁。`);
          return;
      }
      
      setCurrentUser(user);
  };

  const handleDeleteUser = (id: string) => {
      setUsers(prev => prev.filter(u => u.id !== id));
      localStorage.removeItem(`app_chats_${id}`);
      localStorage.removeItem(`app_favorites_${id}`);
      localStorage.removeItem(`app_changelogs_${id}`);
      localStorage.removeItem(`app_settings_${id}`);
      
      if (currentUser?.id === id) {
          setCurrentUser(null);
      }
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    
    // Sync back to current user profile if name/avatar changed
    if (currentUser) {
        const updatedUser = { ...currentUser, name: newSettings.userName, avatar: newSettings.userAvatar };
        if (updatedUser.name !== currentUser.name || updatedUser.avatar !== currentUser.avatar) {
             setCurrentUser(updatedUser);
             setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        }
    }

    // Save Global Configs (Settings + OSS config + Notifications) to local storage for persistence
    const globalConfigToSave: Partial<AppSettings> = {
        providerConfigs: newSettings.providerConfigs,
        activeProvider: newSettings.activeProvider,
        geminiModel: newSettings.geminiModel,
        enableThinking: newSettings.enableThinking,
        bannedIps: newSettings.bannedIps,
        ossConfig: newSettings.ossConfig,
        notificationConfig: newSettings.notificationConfig
    };
    localStorage.setItem('app_global_settings', JSON.stringify(globalConfigToSave));
  };

  // --- Admin User Management Handlers ---
  
  const handleAdminUpdateUser = (userId: string, updates: Partial<UserProfile>) => {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      // If updating current user, sync state
      if (currentUser?.id === userId) {
          setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
  };

  const handleAdminToggleBanIp = (ip: string) => {
      if (!ip) return;
      const currentBanned = settings.bannedIps || [];
      let newBanned: string[];
      
      if (currentBanned.includes(ip)) {
          newBanned = currentBanned.filter(b => b !== ip);
      } else {
          newBanned = [...currentBanned, ip];
      }
      
      const newSettings = { ...settings, bannedIps: newBanned };
      handleUpdateSettings(newSettings);
  };

  const handleValidateAdmin = (u: string, p: string) => {
      return u === adminCredentials.username && p === adminCredentials.password;
  };

  const handleAdminLoginSuccess = () => {
       const adminUser: UserProfile = {
          id: 'admin_root',
          name: 'System Admin',
          avatar: 'https://ui-avatars.com/api/?name=Sys&background=333&color=fff',
          createdAt: Date.now(),
          lastIp: '127.0.0.1'
      };
      setIsAuthenticated(true);
      setCurrentUser(adminUser);
  };

  // Filter lists based on search
  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleUpdateChat = (updatedChat: ChatGroup) => {
    setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c));
  };

  const handleAddChat = () => {
    const newChatId = `group_${Date.now()}`;
    const newChat: ChatGroup = {
        id: newChatId,
        name: '新建群聊',
        avatar: `https://ui-avatars.com/api/?name=New+Group&background=random`,
        lastMessage: '暂无消息',
        timestamp: '刚刚',
        members: [],
        unreadCount: 0,
        type: 'group',
        config: {
            memberConfigs: {},
            speakingOrder: [],
            enableRandomOrder: false
        }
    };
    
    setChats([newChat, ...chats]);
    setSelectedChatId(newChatId);
    setActiveSidebarTab('chats');
    setSearchQuery('');
  };

  const handleSelectChat = (id: string) => {
    setSelectedChatId(id);
    setIsMobileChatOpen(true);
  };

  const handleSelectContact = (persona: Persona) => {
    const existingChat = chats.find(c => 
        c.type === 'private' && 
        c.members.length === 1 && 
        c.members[0] === persona.id
    );

    if (existingChat) {
        setSelectedChatId(existingChat.id);
        setActiveSidebarTab('chats');
        setIsMobileChatOpen(true);
        return;
    }

    const newChatId = `private_${persona.id}_${Date.now()}`;
    const newChat: ChatGroup = {
        id: newChatId,
        name: persona.name,
        avatar: persona.avatar,
        lastMessage: '开始对话',
        timestamp: '刚刚',
        members: [persona.id], 
        type: 'private',
        config: {
            memberConfigs: { [persona.id]: { replyCount: 1, roleId: persona.id } },
            speakingOrder: [persona.id],
            enableRandomOrder: false
        }
    };

    setChats([newChat, ...chats]);
    setSelectedChatId(newChatId);
    setActiveSidebarTab('chats');
    setSearchQuery('');
    setIsMobileChatOpen(true);
  };

  const handleSelectFavorite = (fav: Favorite) => {
      setSelectedFavoriteId(fav.id);
      setIsMobileChatOpen(true);
  };

  const handleSelectLog = (id: string) => {
      setSelectedLogId(id);
      setIsMobileChatOpen(true);
  };

  const handleAddToFavorites = (messages: Message[], sourceName: string) => {
      const isBatch = messages.length > 1;
      const previewText = messages.map(m => m.content).join(' ').substring(0, 50) + '...';
      const type = isBatch ? (messages.length > 10 ? 'chat' : 'batch') : 'single';
      
      const newFavorite: Favorite = {
          id: `fav_${Date.now()}`,
          title: isBatch ? `${sourceName} 的对话收藏` : `消息收藏: ${sourceName}`,
          messages: messages,
          timestamp: Date.now(),
          type: type,
          preview: previewText
      };

      setFavorites([newFavorite, ...favorites]);
  };

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm("确定删除此收藏吗？")) {
          setFavorites(prev => prev.filter(f => f.id !== id));
          if (selectedFavoriteId === id) setSelectedFavoriteId(null);
      }
  };

  const handleAddLog = () => {
    const newLog: ChangelogEntry = {
        id: `log_${Date.now()}`,
        version: 'v1.X.X',
        date: new Date().toISOString().split('T')[0],
        title: '新版本发布',
        content: '在此输入更新内容...'
    };
    setChangelogs([newLog, ...changelogs]);
    setSelectedLogId(newLog.id);
    setIsMobileChatOpen(true);
  };

  const handleUpdateLog = (updatedLog: ChangelogEntry) => {
    setChangelogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
  };

  const handleDeleteLog = (id: string) => {
      setChangelogs(prev => prev.filter(l => l.id !== id));
      if (selectedLogId === id) setSelectedLogId(null);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsSettingsOpen(false);
    // Return to auth modal if current user was admin
    if (currentUser?.id === 'admin_root') {
        setCurrentUser(null);
    }
  };

  // Derived Active Content
  let activeContent = null;
  let activeLog = null;

  if (activeSidebarTab === 'favorites') {
      if (selectedFavoriteId) {
          const fav = favorites.find(f => f.id === selectedFavoriteId);
          if (fav) {
             activeContent = {
                 id: fav.id,
                 name: fav.title,
                 avatar: 'https://ui-avatars.com/api/?name=F&background=orange&color=fff',
                 members: [],
                 isReadOnly: true,
                 type: 'group',
                 messages: fav.messages 
             } as unknown as ChatGroup;
          }
      }
  } else if (activeSidebarTab === 'changelog') {
      activeLog = changelogs.find(l => l.id === selectedLogId);
  } else {
      activeContent = chats.find(c => c.id === selectedChatId);
  }


  // --- Render ---

  if (!currentUser) {
      return (
          <AuthModal 
            users={users}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onDeleteUser={handleDeleteUser}
            onValidateAdmin={handleValidateAdmin}
            onAdminLoginSuccess={handleAdminLoginSuccess}
            syncStatus={syncStatus}
            ossConnectStatus={ossConnectStatus}
            isOssConfigured={isOssConfigured}
          />
      );
  }

  return (
    <div className="flex h-full w-full bg-white select-none relative">
       {/* Sidebar */}
       <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-shrink-0 z-20 h-full`}>
           <Sidebar 
              userAvatar={settings.userAvatar}
              onOpenSettings={() => setIsSettingsOpen(true)}
              activeTab={activeSidebarTab}
              onTabChange={setActiveSidebarTab}
              onOpenAbout={() => setIsAboutModalOpen(true)}
           />
       </div>
       
       {/* List Pane */}
       <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-1 md:flex-none h-full overflow-hidden`}>
           {activeSidebarTab === 'chats' && (
               <ChatList 
                 chats={filteredChats}
                 selectedChatId={selectedChatId} 
                 onSelectChat={handleSelectChat} 
                 searchQuery={searchQuery}
                 onSearchChange={setSearchQuery}
                 onAddChat={handleAddChat}
               />
           )}

           {activeSidebarTab === 'contacts' && (
               <ContactList 
                 personas={personas}
                 onSelectContact={handleSelectContact}
                 searchQuery={searchQuery}
                 onSearchChange={setSearchQuery}
               />
           )}
           
           {activeSidebarTab === 'favorites' && (
               <FavoritesList
                  favorites={favorites}
                  onSelectFavorite={handleSelectFavorite}
                  selectedFavoriteId={selectedFavoriteId}
                  onDeleteFavorite={handleDeleteFavorite}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
               />
           )}

           {activeSidebarTab === 'changelog' && (
               <ChangelogList 
                  logs={changelogs}
                  selectedLogId={selectedLogId}
                  onSelectLog={handleSelectLog}
                  onAddLog={handleAddLog}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  isAuthenticated={isAuthenticated}
               />
           )}
       </div>

       {/* Chat Window / Content */}
       <div className={`
          ${isMobileChatOpen ? 'flex fixed inset-0 z-30 bg-white' : 'hidden'} 
          md:flex md:static md:flex-1 h-full w-full
       `}>
         {activeSidebarTab === 'changelog' ? (
             activeLog ? (
                 <>
                    <div className="flex-1 h-full relative flex flex-col">
                         <div className="md:hidden absolute top-3 left-4 z-50">
                             <button 
                                onClick={() => setIsMobileChatOpen(false)}
                                className="p-1.5 -ml-1 text-gray-500 hover:text-gray-900 rounded-full bg-white/50 backdrop-blur-sm shadow-sm"
                             >
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                             </button>
                         </div>
                         <ChangelogView 
                            log={activeLog}
                            onUpdate={handleUpdateLog}
                            onDelete={handleDeleteLog}
                            isAuthenticated={isAuthenticated}
                         />
                    </div>
                 </>
             ) : (
                <div className="hidden md:flex flex-1 items-center justify-center bg-[#f5f5f5] text-gray-400">
                    <div className="text-center">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <p>请选择左侧日志查看详情</p>
                    </div>
                </div>
             )
         ) : activeContent ? (
             <ChatWindow 
                key={activeContent.id} 
                chat={activeContent} 
                settings={settings}
                allPersonas={personas}
                onUpdateChat={handleUpdateChat}
                onAddToFavorites={handleAddToFavorites}
                onBack={() => setIsMobileChatOpen(false)}
             />
         ) : (
             <div className="hidden md:flex flex-1 items-center justify-center bg-[#f5f5f5] text-gray-400">
               <div className="text-center">
                 <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                 <p>
                     {activeSidebarTab === 'favorites' ? '请选择左侧收藏查看' : '此聊天室暂未接入 AI'}
                 </p>
               </div>
             </div>
         )}
       </div>
       
       <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          personas={personas}
          onUpdatePersonas={setPersonas}
          isAuthenticated={isAuthenticated}
          onLoginSuccess={() => setIsAuthenticated(true)}
          adminCredentials={adminCredentials}
          onUpdateAdminCredentials={setAdminCredentials}
          onLogout={handleLogout}
          onSwitchUser={() => setCurrentUser(null)}
          // User Management Props
          allUsers={users}
          onAdminUpdateUser={handleAdminUpdateUser}
          onAdminDeleteUser={handleDeleteUser}
          onAdminToggleBanIp={handleAdminToggleBanIp}
          onUpdateAllUsers={setUsers}
       />

       <AboutModal 
          isOpen={isAboutModalOpen}
          onClose={() => setIsAboutModalOpen(false)}
          content={aboutContent}
          onUpdateContent={setAboutContent}
          isAuthenticated={isAuthenticated}
       />
    </div>
  );
};

export default App;
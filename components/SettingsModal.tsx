import React, { useState, useEffect } from 'react';
import { AppSettings, GeminiModelId, ProviderId, ProviderConfig, Persona, ModelOption, UserProfile } from '../types';
import { MODEL_PROVIDERS } from '../constants';
import { generateRandomPersonaDetails } from '../services/geminiService';
import { uploadGlobalConfig, downloadGlobalConfig } from '../services/ossService';
import { sendBarkNotification } from '../services/notificationService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  personas: Persona[];
  onUpdatePersonas: (newPersonas: Persona[]) => void;
  isAuthenticated: boolean;
  onLoginSuccess: () => void;
  adminCredentials: { username: string; password: string };
  onUpdateAdminCredentials: (creds: { username: string; password: string }) => void;
  onLogout: () => void;
  onSwitchUser: () => void;
  
  // User Management
  allUsers?: UserProfile[];
  onAdminUpdateUser?: (userId: string, updates: Partial<UserProfile>) => void;
  onAdminDeleteUser?: (userId: string) => void;
  onAdminToggleBanIp?: (ip: string) => void;
  onUpdateAllUsers?: (users: UserProfile[]) => void;
}

type Tab = 'profile' | 'models' | 'characters' | 'users' | 'cloud' | 'notifications';

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  settings, 
  onUpdateSettings,
  personas,
  onUpdatePersonas,
  isAuthenticated,
  onLoginSuccess,
  adminCredentials,
  onUpdateAdminCredentials,
  onLogout,
  onSwitchUser,
  allUsers,
  onAdminUpdateUser,
  onAdminDeleteUser,
  onAdminToggleBanIp,
  onUpdateAllUsers
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  
  // Local state for edits
  const [localAvatar, setLocalAvatar] = useState(settings.userAvatar);
  const [localUserName, setLocalUserName] = useState(settings.userName || 'User');
  const [localGeminiModel, setLocalGeminiModel] = useState<GeminiModelId>(settings.geminiModel);
  const [localEnableThinking, setLocalEnableThinking] = useState(settings.enableThinking);
  const [localMaxReplyLength, setLocalMaxReplyLength] = useState(settings.maxReplyLength || 200);
  const [localActiveProvider, setLocalActiveProvider] = useState<ProviderId>(settings.activeProvider);
  
  // Local state for admin credentials editing
  const [localAdminUsername, setLocalAdminUsername] = useState(adminCredentials.username);
  const [localAdminPassword, setLocalAdminPassword] = useState(adminCredentials.password);
  
  // Store full provider configs locally while editing
  const [localProviderConfigs, setLocalProviderConfigs] = useState<Record<ProviderId, ProviderConfig>>(settings.providerConfigs);
  
  // Local Personas State
  const [localPersonas, setLocalPersonas] = useState<Persona[]>(personas);
  const [editingPersonaId, setEditingPersonaId] = useState<string | null>(null);
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false);
  const [draggedPersonaIndex, setDraggedPersonaIndex] = useState<number | null>(null);

  // Local OSS Config
  const [localOssConfig, setLocalOssConfig] = useState(settings.ossConfig || {
      region: '', accessKeyId: '', accessKeySecret: '', bucket: '', path: '', enabled: false, autoSync: false
  });
  
  // Local Notification Config
  const [localNotificationConfig, setLocalNotificationConfig] = useState(settings.notificationConfig || {
      enabled: false, serverUrl: 'https://api.day.app', deviceKey: ''
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const [isFetchingModels, setIsFetchingModels] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<Record<string, string>>({});
  const [exportedCode, setExportedCode] = useState<string | null>(null);

  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');

  // Sync props to local state when opening
  useEffect(() => {
    if (isOpen) {
      setLocalAvatar(settings.userAvatar);
      setLocalUserName(settings.userName || 'User');
      setLocalGeminiModel(settings.geminiModel);
      setLocalEnableThinking(settings.enableThinking);
      setLocalMaxReplyLength(settings.maxReplyLength || 200);
      setLocalActiveProvider(settings.activeProvider);
      setLocalProviderConfigs(settings.providerConfigs);
      setLocalPersonas(personas);
      setLocalAdminUsername(adminCredentials.username);
      setLocalAdminPassword(adminCredentials.password);
      if (settings.ossConfig) setLocalOssConfig(settings.ossConfig);
      if (settings.notificationConfig) setLocalNotificationConfig(settings.notificationConfig);
      setIsSaving(false);
    }
  }, [isOpen, settings, personas, adminCredentials]);

  // Reset tab if not authenticated and on restricted tab
  useEffect(() => {
      if (!isAuthenticated && (activeTab === 'models' || activeTab === 'characters' || activeTab === 'users' || activeTab === 'cloud' || activeTab === 'notifications')) {
          setActiveTab('profile');
      }
  }, [isAuthenticated, activeTab]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (isSaving) return;

    const newSettings = {
      ...settings,
      userAvatar: localAvatar,
      userName: localUserName,
      geminiModel: localGeminiModel,
      enableThinking: localEnableThinking,
      maxReplyLength: localMaxReplyLength,
      activeProvider: localActiveProvider,
      providerConfigs: localProviderConfigs,
      ossConfig: localOssConfig,
      notificationConfig: localNotificationConfig
    };
    
    // Update Local State
    onUpdateSettings(newSettings);
    
    // Only update personas/admin-creds if Admin
    if (isAuthenticated) {
        onUpdatePersonas(localPersonas);
        const newAdminCreds = { username: localAdminUsername, password: localAdminPassword };
        onUpdateAdminCredentials(newAdminCreds);

        // Auto Upload to OSS if enabled
        if (localOssConfig.enabled) {
            setIsSaving(true);
            try {
                // Upload current state to cloud
                await uploadGlobalConfig(newSettings, localPersonas, allUsers || [], newAdminCreds, localUserName);
                console.log('Auto-uploaded config to OSS');
            } catch (e) {
                console.error('Auto upload failed', e);
                alert(`设置已保存，但自动同步到云端失败：${e instanceof Error ? e.message : String(e)}`);
            } finally {
                setIsSaving(false);
            }
        }
    }
    
    onClose();
  };

  const handleExportDefaults = () => {
      const currentConfig: AppSettings = {
          userAvatar: localAvatar,
          userName: localUserName,
          geminiModel: localGeminiModel,
          enableThinking: localEnableThinking,
          maxReplyLength: localMaxReplyLength,
          activeProvider: localActiveProvider,
          providerConfigs: localProviderConfigs,
          bannedIps: settings.bannedIps,
          ossConfig: localOssConfig,
          notificationConfig: localNotificationConfig
      };
      
      const code = `// 请将下方代码复制到 constants.ts 并覆盖 DEFAULT_APP_SETTINGS 变量\n\nexport const DEFAULT_APP_SETTINGS: AppSettings = ${JSON.stringify(currentConfig, null, 2)};`;
      setExportedCode(code);
  };

  const updateProviderConfig = (providerId: ProviderId, key: keyof ProviderConfig, value: any) => {
    setLocalProviderConfigs(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [key]: value
      }
    }));
  };
  
  // --- OSS Logic ---
  const handleUploadToOss = async () => {
      if (!isAuthenticated) return;
      setIsSyncing(true);
      setSyncStatus('正在上传配置到云端...');
      try {
          const tempSettings: AppSettings = {
              ...settings,
              providerConfigs: localProviderConfigs,
              activeProvider: localActiveProvider,
              geminiModel: localGeminiModel,
              enableThinking: localEnableThinking,
              ossConfig: localOssConfig,
              notificationConfig: localNotificationConfig,
              userAvatar: localAvatar,
              userName: localUserName
          };
          const tempAdminCreds = { username: localAdminUsername, password: localAdminPassword };
          await uploadGlobalConfig(tempSettings, localPersonas, allUsers || [], tempAdminCreds, settings.userName);
          setSyncStatus(`上传成功! (${new Date().toLocaleTimeString()})`);
      } catch (e) {
          console.error(e);
          setSyncStatus(`上传失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDownloadFromOss = async () => {
      setIsSyncing(true);
      setSyncStatus('正在从云端拉取配置...');
      try {
          const tempSettings: AppSettings = { ...settings, ossConfig: localOssConfig };
          const data = await downloadGlobalConfig(tempSettings);
          
          if (data) {
              if (data.appSettings.providerConfigs) setLocalProviderConfigs(data.appSettings.providerConfigs as any);
              if (data.appSettings.activeProvider) setLocalActiveProvider(data.appSettings.activeProvider as any);
              if (data.appSettings.geminiModel) setLocalGeminiModel(data.appSettings.geminiModel as any);
              if (data.appSettings.enableThinking !== undefined) setLocalEnableThinking(data.appSettings.enableThinking);
              if (data.appSettings.maxReplyLength !== undefined) setLocalMaxReplyLength(data.appSettings.maxReplyLength);
              if (data.appSettings.notificationConfig) setLocalNotificationConfig(data.appSettings.notificationConfig);
              if (data.appSettings.userAvatar) setLocalAvatar(data.appSettings.userAvatar);
              if (data.appSettings.userName) setLocalUserName(data.appSettings.userName);
              
              if (data.personas) setLocalPersonas(data.personas);
              
              if (data.users && onUpdateAllUsers) {
                  onUpdateAllUsers(data.users);
              }

              if (data.adminAuth) {
                  setLocalAdminUsername(data.adminAuth.username);
                  setLocalAdminPassword(data.adminAuth.password);
                  onUpdateAdminCredentials(data.adminAuth);
              }
              
              setSyncStatus(`同步成功! 更新于: ${new Date(data.timestamp).toLocaleString()}`);
          } else {
              setSyncStatus('云端无配置文件或下载为空');
          }
      } catch (e) {
           console.error(e);
           setSyncStatus(`同步失败: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleFetchModels = async (providerId: ProviderId) => {
    const config = localProviderConfigs[providerId];
    if (!config.baseUrl || !config.apiKey) {
      setFetchError(prev => ({ ...prev, [providerId]: '需填写 Base URL 和 API Key' }));
      return;
    }

    setIsFetchingModels(prev => ({ ...prev, [providerId]: true }));
    setFetchError(prev => ({ ...prev, [providerId]: '' }));

    try {
      const baseUrl = config.baseUrl.replace(/\/$/, '');
      let url = `${baseUrl}/models`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Status: ${response.status}`);
      }

      const data = await response.json();
      let models: ModelOption[] = [];

      if (data.data && Array.isArray(data.data)) {
        models = data.data.map((m: any) => ({
          id: m.id,
          name: m.id 
        }));
      } else {
         throw new Error('Unrecognized response format');
      }

      if (models.length === 0) {
         throw new Error('No models found');
      }

      updateProviderConfig(providerId, 'fetchedModels', models);
      setFetchError(prev => ({ ...prev, [providerId]: '' }));
    } catch (err) {
      console.error(err);
      setFetchError(prev => ({ ...prev, [providerId]: `失败: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setIsFetchingModels(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTestNotification = async () => {
      if (!localNotificationConfig.deviceKey) {
          alert("请先输入 Device Key");
          return;
      }
      await sendBarkNotification("Bark 测试", "这是一条测试消息。如果您收到此消息，说明配置成功。", localNotificationConfig);
  };

  const handleAddPersona = () => {
    const newId = `custom_${Date.now()}`;
    const newPersona: Persona = {
      id: newId,
      name: '新角色',
      role: 'Role',
      avatar: `https://ui-avatars.com/api/?name=New&background=random`,
      systemInstruction: '你是一个乐于助人的AI助手。',
      color: 'text-gray-600',
      config: {
        provider: 'gemini',
        modelId: 'gemini-2.5-flash'
      }
    };
    setLocalPersonas([...localPersonas, newPersona]);
    setEditingPersonaId(newId);
  };

  const handleDeletePersona = (id: string) => {
    if (window.confirm('确定要删除这个角色吗？')) {
      setLocalPersonas(localPersonas.filter(p => p.id !== id));
      if (editingPersonaId === id) setEditingPersonaId(null);
    }
  };

  const updatePersonaField = (id: string, field: keyof Persona, value: any) => {
    setLocalPersonas(localPersonas.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const updatePersonaConfig = (id: string, field: keyof Persona['config'], value: any) => {
    setLocalPersonas(localPersonas.map(p => 
        p.id === id ? { 
            ...p, 
            config: { 
                ...p.config,
                [field]: value,
                ...(field === 'provider' ? { modelId: MODEL_PROVIDERS.find(prov => prov.id === value)?.models[0].id || '' } : {})
            } 
        } : p
    ));
  };
  
  const handleAIGeneratePersona = async () => {
    if (!editingPersonaId) return;
    setIsGeneratingPersona(true);
    try {
        const details = await generateRandomPersonaDetails(settings);
        const randomProvider = MODEL_PROVIDERS[Math.floor(Math.random() * MODEL_PROVIDERS.length)];
        const randomModel = randomProvider.models[Math.floor(Math.random() * randomProvider.models.length)];
        
        const encodedPrompt = encodeURIComponent(details.avatarPrompt);
        const avatarUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=200&height=200&nologo=true`;

        setLocalPersonas(prev => prev.map(p => {
            if (p.id === editingPersonaId) {
                return {
                    ...p,
                    name: details.name,
                    role: randomModel.name,
                    systemInstruction: details.systemInstruction,
                    avatar: avatarUrl,
                    config: {
                        provider: randomProvider.id,
                        modelId: randomModel.id
                    }
                };
            }
            return p;
        }));

    } catch (e) {
        console.error(e);
        alert("生成失败，请检查网络设置或 API Key");
    } finally {
        setIsGeneratingPersona(false);
    }
  };

  const startEditingUser = (user: UserProfile) => {
      setEditingUserId(user.id);
      setEditUserName(user.name);
  };

  const saveUserEdit = () => {
      if (editingUserId && onAdminUpdateUser) {
          onAdminUpdateUser(editingUserId, { name: editUserName });
          setEditingUserId(null);
      }
  };

  // --- Drag and Drop Handlers for Characters ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedPersonaIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedPersonaIndex === null || draggedPersonaIndex === index) return;

    const newPersonas = [...localPersonas];
    const draggedItem = newPersonas[draggedPersonaIndex];
    
    // Remove from old
    newPersonas.splice(draggedPersonaIndex, 1);
    // Insert at new
    newPersonas.splice(index, 0, draggedItem);
    
    setLocalPersonas(newPersonas);
    setDraggedPersonaIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedPersonaIndex(null);
  };

  // --- Render Tabs ---

  const renderProfileTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">个人资料</h3>
                <button 
                    onClick={() => {
                        onClose();
                        onSwitchUser();
                    }}
                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded transition-colors"
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                    切换账号 / Switch Account
                </button>
            </div>

            <div className="flex flex-col items-center mb-6">
              <div className="relative group cursor-pointer">
                <img 
                    src={localAvatar} 
                    alt="Avatar Preview" 
                    className="w-24 h-24 rounded-full mb-3 object-cover bg-gray-200 border-2 border-white shadow-md" 
                    onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/error/100/100')}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">头像链接 (URL)</label>
                <input 
                  type="text" 
                  value={localAvatar}
                  onChange={(e) => setLocalAvatar(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名 (User Name)</label>
                <input 
                  type="text" 
                  value={localUserName}
                  onChange={(e) => setLocalUserName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                  placeholder="User"
                />
              </div>
            </div>

            {isAuthenticated && (
                <div className="pt-4 border-t border-gray-100 mt-6">
                   <h4 className="text-sm font-medium text-gray-900 mb-3">管理员账号设置</h4>
                   <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">账号</label>
                        <input 
                            type="text" 
                            value={localAdminUsername}
                            onChange={(e) => setLocalAdminUsername(e.target.value)}
                            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                       <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">密码</label>
                        <input 
                            type="text" 
                            value={localAdminPassword}
                            onChange={(e) => setLocalAdminPassword(e.target.value)}
                            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                        />
                      </div>
                      <div className="text-[10px] text-orange-600 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                          修改此处将更新登录后台所需的凭证
                      </div>
                   </div>
                </div>
            )}
            
            {isAuthenticated && (
                <div className="pt-4 border-t border-gray-100 mt-6">
                   <h4 className="text-sm font-medium text-gray-900 mb-2">部署配置</h4>
                   <p className="text-xs text-gray-500 mb-3">将当前的个人设置、API 配置和模型选择导出为系统默认值。部署后，所有新用户将默认使用此配置。</p>
                   <button 
                      onClick={handleExportDefaults}
                      className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
                   >
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                       导出为系统默认配置 (Export Defaults)
                   </button>
                </div>
            )}
            
            {isAuthenticated && (
                <div className="pt-2">
                     <button 
                        onClick={onLogout}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline"
                     >
                        退出管理员登录
                     </button>
                </div>
            )}
        </div>
    </div>
  );

  const renderUsersTab = () => (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
                <h3 className="text-lg font-medium text-gray-900">用户管理 (User Management)</h3>
                <p className="text-xs text-gray-500">管理已注册用户、IP 记录与封禁状态。</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-200 rounded-lg">
              <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                      <tr>
                          <th scope="col" className="px-4 py-3">用户</th>
                          <th scope="col" className="px-4 py-3">注册时间</th>
                          <th scope="col" className="px-4 py-3">Last IP</th>
                          <th scope="col" className="px-4 py-3 text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody>
                      {allUsers?.map(user => {
                          const isBanned = user.lastIp && settings.bannedIps?.includes(user.lastIp);
                          const isEditing = editingUserId === user.id;

                          return (
                              <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap flex items-center gap-3">
                                      <img src={user.avatar} className="w-8 h-8 rounded-full bg-gray-200" />
                                      {isEditing ? (
                                          <div className="flex items-center gap-1">
                                              <input 
                                                  type="text" 
                                                  value={editUserName} 
                                                  onChange={(e) => setEditUserName(e.target.value)}
                                                  className="border border-gray-300 rounded px-2 py-1 text-xs w-24"
                                              />
                                              <button onClick={saveUserEdit} className="text-green-600 hover:text-green-800">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                              </button>
                                              <button onClick={() => setEditingUserId(null)} className="text-gray-400 hover:text-gray-600">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                              </button>
                                          </div>
                                      ) : (
                                          <span>{user.name}</span>
                                      )}
                                      {user.id === 'admin_root' && <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">Admin</span>}
                                  </td>
                                  <td className="px-4 py-3 text-xs">
                                      {new Date(user.createdAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 font-mono text-xs">
                                      {user.lastIp || 'N/A'}
                                      {isBanned && <span className="ml-2 bg-red-100 text-red-600 text-[10px] px-1.5 rounded">BANNED</span>}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      {user.id !== 'admin_root' && (
                                          <div className="flex items-center justify-end gap-2">
                                              <button 
                                                  onClick={() => startEditingUser(user)}
                                                  className="text-blue-600 hover:underline text-xs"
                                              >
                                                  改名
                                              </button>
                                              <button 
                                                  onClick={() => onAdminToggleBanIp && user.lastIp && onAdminToggleBanIp(user.lastIp)}
                                                  className={`text-xs hover:underline ${isBanned ? 'text-green-600' : 'text-orange-600'}`}
                                                  disabled={!user.lastIp}
                                              >
                                                  {isBanned ? '解封 IP' : '封禁 IP'}
                                              </button>
                                              <button 
                                                  onClick={() => {
                                                      if(window.confirm(`确定删除用户 ${user.name} 吗? 数据不可恢复。`)) {
                                                          onAdminDeleteUser && onAdminDeleteUser(user.id);
                                                      }
                                                  }}
                                                  className="text-red-600 hover:underline text-xs"
                                              >
                                                  删除
                                              </button>
                                          </div>
                                      )}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
  );

  const renderNotificationsTab = () => (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
                <h3 className="text-lg font-medium text-gray-900">通知推送 (Notifications)</h3>
                <p className="text-xs text-gray-500">配置 Bark 用于接收新用户注册提醒。</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
                  <div className="space-y-4">
                       <div className="flex items-center">
                          <input 
                            id="enableBark" 
                            type="checkbox" 
                            checked={localNotificationConfig.enabled}
                            onChange={(e) => setLocalNotificationConfig({...localNotificationConfig, enabled: e.target.checked})}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                          />
                          <label htmlFor="enableBark" className="ml-2 text-sm text-gray-700 font-medium">
                             启用新用户注册提醒 (Enable New User Alerts)
                          </label>
                      </div>

                      <div className="grid grid-cols-1 gap-4 pt-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Bark Server URL</label>
                            <input 
                                type="text" 
                                placeholder="https://api.day.app"
                                value={localNotificationConfig.serverUrl}
                                onChange={(e) => setLocalNotificationConfig({...localNotificationConfig, serverUrl: e.target.value})}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Device Key</label>
                            <input 
                                type="text" 
                                placeholder="Bark App 中的 Key"
                                value={localNotificationConfig.deviceKey}
                                onChange={(e) => setLocalNotificationConfig({...localNotificationConfig, deviceKey: e.target.value})}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-mono"
                            />
                          </div>
                      </div>
                      
                      <div className="pt-2">
                          <button 
                            onClick={handleTestNotification}
                            disabled={!localNotificationConfig.deviceKey}
                            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded transition-colors disabled:opacity-50"
                          >
                              发送测试推送 (Send Test)
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
  
  const renderCloudTab = () => {
    const hasEnvRegion = !!process.env.OSS_REGION;
    const hasEnvAccessKey = !!process.env.OSS_ACCESS_KEY_ID;
    const isEnvManaged = hasEnvRegion && hasEnvAccessKey;

    return (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
                <h3 className="text-lg font-medium text-gray-900">云端同步 (Cloud Sync)</h3>
                <p className="text-xs text-gray-500">接入阿里云 OSS，实现配置的云端存储与多端同步。</p>
            </div>
            {isEnvManaged && (
                <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded text-xs font-medium border border-purple-200 flex items-center gap-1">
                    Managed by Environment
                </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 relative">
                  <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                       OSS 配置
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Region (地域节点)</label>
                          <input 
                              type="text" 
                              placeholder="oss-cn-hangzhou"
                              value={localOssConfig.region}
                              onChange={(e) => setLocalOssConfig({...localOssConfig, region: e.target.value})}
                              className={`w-full border border-blue-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEnvManaged ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                              disabled={isEnvManaged}
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Bucket Name</label>
                          <input 
                              type="text" 
                              placeholder="my-ai-config"
                              value={localOssConfig.bucket}
                              onChange={(e) => setLocalOssConfig({...localOssConfig, bucket: e.target.value})}
                              className={`w-full border border-blue-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEnvManaged ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                              disabled={isEnvManaged}
                          />
                      </div>
                      <div className="col-span-2">
                           <label className="block text-xs font-medium text-gray-600 mb-1">AccessKey ID</label>
                          <input 
                              type="text" 
                              value={isEnvManaged ? `${localOssConfig.accessKeyId.substring(0, 4)}... (from env)` : localOssConfig.accessKeyId}
                              onChange={(e) => setLocalOssConfig({...localOssConfig, accessKeyId: e.target.value})}
                              className={`w-full border border-blue-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEnvManaged ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                              disabled={isEnvManaged}
                          />
                      </div>
                      <div className="col-span-2">
                           <label className="block text-xs font-medium text-gray-600 mb-1">AccessKey Secret</label>
                          <input 
                              type="password" 
                              value={localOssConfig.accessKeySecret}
                              onChange={(e) => setLocalOssConfig({...localOssConfig, accessKeySecret: e.target.value})}
                              className={`w-full border border-blue-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEnvManaged ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                              disabled={isEnvManaged}
                              placeholder={isEnvManaged ? "Hidden (Loaded from Environment)" : ""}
                          />
                      </div>
                      <div className="col-span-2">
                           <label className="block text-xs font-medium text-gray-600 mb-1">存储路径 (Path)</label>
                          <input 
                              type="text" 
                              placeholder="ai-roundtable/config.json"
                              value={localOssConfig.path}
                              onChange={(e) => setLocalOssConfig({...localOssConfig, path: e.target.value})}
                              className={`w-full border border-blue-200 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none ${isEnvManaged ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                              disabled={isEnvManaged}
                          />
                      </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-4 border-t border-blue-200 pt-3">
                      <div className="flex items-center">
                          <input 
                            id="enableOss" 
                            type="checkbox" 
                            checked={localOssConfig.enabled}
                            onChange={(e) => setLocalOssConfig({...localOssConfig, enabled: e.target.checked})}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                            disabled={isEnvManaged}
                          />
                          <label htmlFor="enableOss" className={`ml-2 text-sm text-gray-700 ${isEnvManaged ? 'opacity-70' : ''}`}>
                             启用云端同步 (Enable) {isEnvManaged && '(Enforced)'}
                          </label>
                      </div>
                      <div className="flex items-center">
                          <input 
                            id="autoSync" 
                            type="checkbox" 
                            checked={localOssConfig.autoSync}
                            onChange={(e) => setLocalOssConfig({...localOssConfig, autoSync: e.target.checked})}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                            disabled={isEnvManaged}
                          />
                          <label htmlFor="autoSync" className={`ml-2 text-sm text-gray-700 ${isEnvManaged ? 'opacity-70' : ''}`}>
                              启动时自动拉取 (Auto Pull) {isEnvManaged && '(Enforced)'}
                          </label>
                      </div>
                  </div>
              </div>
              
              <div className="space-y-4">
                  <div className="flex gap-4">
                      {isAuthenticated && (
                          <button 
                            onClick={handleUploadToOss}
                            disabled={isSyncing || !localOssConfig.enabled}
                            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isSyncing ? '...' : '上传配置 (Admin Push)'}
                          </button>
                      )}
                      
                      <button 
                        onClick={handleDownloadFromOss}
                        disabled={isSyncing || !localOssConfig.enabled}
                        className="flex-1 border border-gray-300 bg-white text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                           {isSyncing ? '...' : '拉取配置 (Pull Sync)'}
                      </button>
                  </div>
                  
                  {syncStatus && (
                      <div className={`text-xs p-2 rounded ${syncStatus.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {syncStatus}
                      </div>
                  )}
              </div>
          </div>
      </div>
    );
  };

  const renderModelsTab = () => (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
       <h3 className="text-lg font-medium text-gray-900">大模型接入配置 (Admin)</h3>
       <p className="text-xs text-gray-500 -mt-3">在此配置全局 API Key 和默认参数。所有用户的对话将使用此配置。</p>
       
       <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-6 pb-6">
           {/* Global Settings */}
           <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
               <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                   通用生成参数
               </h4>
               <div className="grid grid-cols-2 gap-4">
                   <div>
                       <label className="block text-xs font-medium text-gray-600 mb-1">单次回复字数限制 (Max Length)</label>
                       <input 
                            type="number"
                            min="50"
                            max="2000"
                            step="50"
                            value={localMaxReplyLength}
                            onChange={(e) => setLocalMaxReplyLength(parseInt(e.target.value) || 200)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                       />
                       <p className="text-[10px] text-gray-400 mt-1">控制 AI 单次回复的最大篇幅 (建议 200-500)</p>
                   </div>
                   <div className="flex items-center pt-5">
                       <input 
                            type="checkbox"
                            checked={localEnableThinking}
                            onChange={(e) => setLocalEnableThinking(e.target.checked)}
                            className="mr-2"
                       />
                       <span className="text-xs text-gray-700">启用 Thinking (仅 Gemini 2.5 支持)</span>
                   </div>
               </div>
           </div>

           {MODEL_PROVIDERS.map(provider => {
             const isActive = localActiveProvider === provider.id;
             const config = localProviderConfigs[provider.id];
             
             const availableModels = config.fetchedModels && config.fetchedModels.length > 0 
                ? config.fetchedModels 
                : provider.models;

             return (
              <div 
                key={provider.id} 
                className={`border rounded-lg p-4 transition-all ${
                  isActive 
                    ? 'border-green-400 bg-green-50 shadow-sm ring-1 ring-green-400' 
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                 <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3">
                         <img src={provider.icon} alt={provider.name} className="w-8 h-8 rounded-md" />
                         <div>
                             <div className="font-medium text-sm text-gray-900 flex items-center">
                               {provider.name}
                               {isActive && <span className="ml-2 bg-green-200 text-green-800 text-[10px] px-1.5 rounded-full">Default</span>}
                             </div>
                             <div className="text-xs text-gray-500">{provider.description}</div>
                         </div>
                     </div>
                     <button 
                       onClick={() => setLocalActiveProvider(provider.id)}
                       className={`text-xs px-3 py-1 rounded transition-colors border ${
                          isActive 
                          ? 'bg-green-600 text-white border-green-600' 
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                       }`}
                     >
                        {isActive ? '默认服务' : '设为默认'}
                     </button>
                 </div>

                 <div className={`space-y-3`}>
                    {provider.fields.map(field => (
                        <div key={field.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                            <input 
                                type={field.type}
                                value={config[field.key] || ''}
                                onChange={(e) => updateProviderConfig(provider.id, field.key as any, e.target.value)}
                                className={`w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 ${isActive ? 'focus:ring-green-500' : 'focus:ring-gray-400'}`}
                                placeholder={field.placeholder}
                            />
                        </div>
                    ))}

                    <div className="pt-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">默认模型 (Default Model)</label>
                        <div className="flex gap-2">
                            <select 
                                value={config.selectedModel}
                                onChange={(e) => updateProviderConfig(provider.id, 'selectedModel', e.target.value)}
                                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            
                            {provider.id !== 'gemini' && (
                                <button 
                                    onClick={() => handleFetchModels(provider.id)}
                                    disabled={isFetchingModels[provider.id]}
                                    className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded border border-gray-300 whitespace-nowrap"
                                >
                                    {isFetchingModels[provider.id] ? 'Fetching...' : '获取模型列表'}
                                </button>
                            )}
                        </div>
                        {fetchError[provider.id] && (
                            <p className="text-[10px] text-red-500 mt-1">{fetchError[provider.id]}</p>
                        )}
                    </div>
                 </div>
              </div>
             );
           })}
       </div>
    </div>
  );

  const renderCharactersTab = () => (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-medium text-gray-900">角色管理 (Admin)</h3>
             <button 
                onClick={handleAddPersona}
                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 flex items-center gap-1"
             >
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 添加角色
             </button>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
             <div className="space-y-4">
                 {localPersonas.map((persona, index) => {
                     const isEditing = editingPersonaId === persona.id;
                     const isDragging = draggedPersonaIndex === index;
                     
                     return (
                         <div 
                            key={persona.id} 
                            draggable={!isEditing}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`border border-gray-200 rounded-lg p-4 bg-white relative group transition-all ${
                                isDragging ? 'opacity-50 border-dashed border-gray-400' : ''
                            }`}
                         >
                            <div className="flex gap-3">
                                {/* Drag Handle */}
                                {!isEditing && (
                                    <div 
                                        className="mt-3 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing"
                                        title="拖拽排序"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16"></path></svg>
                                    </div>
                                )}
                                
                                <div className="flex-1">
                                     <div className="flex items-start justify-between">
                                         <div className="flex gap-3">
                                             <div className="relative">
                                                 <img src={persona.avatar} alt="avatar" className="w-10 h-10 rounded-md bg-gray-100 object-cover" />
                                                 {isEditing && (
                                                     <div className="absolute -bottom-1 -right-1">
                                                         <button 
                                                            onClick={() => setEditingPersonaId(null)}
                                                            className="bg-gray-800 text-white text-[10px] p-0.5 rounded"
                                                         >
                                                             Done
                                                         </button>
                                                     </div>
                                                 )}
                                             </div>
                                             <div>
                                                 {isEditing ? (
                                                     <div className="flex flex-col gap-1">
                                                         <input 
                                                            value={persona.name} 
                                                            onChange={(e) => updatePersonaField(persona.id, 'name', e.target.value)}
                                                            className="text-sm font-bold border rounded px-1 py-0.5"
                                                            placeholder="Name"
                                                         />
                                                         <input 
                                                            value={persona.role} 
                                                            onChange={(e) => updatePersonaField(persona.id, 'role', e.target.value)}
                                                            className="text-xs text-gray-500 border rounded px-1 py-0.5"
                                                            placeholder="Role"
                                                         />
                                                     </div>
                                                 ) : (
                                                     <>
                                                         <div className="font-bold text-sm text-gray-900">{persona.name}</div>
                                                         <div className="text-xs text-gray-500">{persona.role}</div>
                                                     </>
                                                 )}
                                             </div>
                                         </div>
                                         
                                         <div className="flex items-center gap-2">
                                             {!isEditing && (
                                                 <button 
                                                    onClick={() => setEditingPersonaId(persona.id)}
                                                    className="text-gray-400 hover:text-blue-600 p-1"
                                                 >
                                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                                 </button>
                                             )}
                                             <button 
                                                onClick={() => handleDeletePersona(persona.id)}
                                                className="text-gray-400 hover:text-red-600 p-1"
                                             >
                                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                             </button>
                                         </div>
                                     </div>

                                     {isEditing ? (
                                         <div className="mt-4 space-y-3 border-t pt-3 border-gray-100">
                                              <div className="flex items-center gap-2">
                                                   <button 
                                                        onClick={handleAIGeneratePersona}
                                                        disabled={isGeneratingPersona}
                                                        className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded flex items-center gap-1 hover:bg-purple-100"
                                                   >
                                                        {isGeneratingPersona ? 'Generating...' : '🎲 AI Generate Profile'}
                                                   </button>
                                              </div>
                                             
                                             <div>
                                                 <label className="block text-xs font-medium text-gray-500 mb-1">Avatar URL</label>
                                                 <input 
                                                    value={persona.avatar} 
                                                    onChange={(e) => updatePersonaField(persona.id, 'avatar', e.target.value)}
                                                    className="w-full text-xs border rounded px-2 py-1"
                                                 />
                                             </div>
                                             <div>
                                                 <label className="block text-xs font-medium text-gray-500 mb-1">System Instruction (Prompt)</label>
                                                 <textarea 
                                                    value={persona.systemInstruction} 
                                                    onChange={(e) => updatePersonaField(persona.id, 'systemInstruction', e.target.value)}
                                                    className="w-full text-xs border rounded px-2 py-1 h-20"
                                                 />
                                             </div>
                                             <div className="grid grid-cols-2 gap-2">
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
                                                     <select 
                                                        value={persona.config.provider}
                                                        onChange={(e) => updatePersonaConfig(persona.id, 'provider', e.target.value)}
                                                        className="w-full text-xs border rounded px-2 py-1"
                                                     >
                                                         {MODEL_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                     </select>
                                                 </div>
                                                 <div>
                                                     <label className="block text-xs font-medium text-gray-500 mb-1">Model ID</label>
                                                     {/* Dynamic Select for Models */}
                                                     {(() => {
                                                         const pid = persona.config.provider;
                                                         const pConfig = localProviderConfigs[pid];
                                                         const pStatic = MODEL_PROVIDERS.find(p => p.id === pid);
                                                         
                                                         // Get available models (Fetched > Static)
                                                         let available = pConfig?.fetchedModels?.length 
                                                            ? pConfig.fetchedModels 
                                                            : (pStatic?.models || []);
                                                         
                                                         // Guard: If empty, show basic input
                                                         if (available.length === 0) {
                                                             return (
                                                                 <input 
                                                                    value={persona.config.modelId}
                                                                    onChange={(e) => updatePersonaConfig(persona.id, 'modelId', e.target.value)}
                                                                    className="w-full text-xs border rounded px-2 py-1"
                                                                 />
                                                             );
                                                         }

                                                         // Ensure current value is preserved in options (if custom or old)
                                                         const current = persona.config.modelId;
                                                         if (current && !available.some(m => m.id === current)) {
                                                             available = [{ id: current, name: `${current} (Custom)` }, ...available];
                                                         }

                                                         return (
                                                            <div className="relative">
                                                                <select 
                                                                    value={persona.config.modelId}
                                                                    onChange={(e) => updatePersonaConfig(persona.id, 'modelId', e.target.value)}
                                                                    className="w-full text-xs border rounded px-2 py-1 bg-white appearance-none pr-6"
                                                                >
                                                                    {available.map(m => (
                                                                        <option key={m.id} value={m.id}>
                                                                            {m.name}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {/* Custom Arrow to indicate Select */}
                                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                                                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                                </div>
                                                            </div>
                                                         );
                                                     })()}
                                                 </div>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="mt-2 text-xs text-gray-600 line-clamp-2">
                                             {persona.systemInstruction}
                                         </div>
                                     )}
                                </div>
                            </div>
                         </div>
                     );
                 })}
             </div>
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[800px] h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex h-full">
            {/* Sidebar Navigation */}
            <div className="flex flex-col w-[200px] border-r border-gray-100 bg-gray-50 p-4 gap-1">
                <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Settings</h2>
                
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    个人资料
                </button>

                {isAuthenticated && (
                    <>
                        <button 
                            onClick={() => setActiveTab('models')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'models' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            模型接入
                        </button>
                        <button 
                            onClick={() => setActiveTab('characters')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'characters' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            角色管理
                        </button>
                         <button 
                            onClick={() => setActiveTab('users')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            用户管理
                        </button>
                        <button 
                            onClick={() => setActiveTab('cloud')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cloud' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            云端同步
                        </button>
                        <button 
                            onClick={() => setActiveTab('notifications')}
                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            通知推送
                        </button>
                    </>
                )}
            </div>

            {/* Content Area */}
            <div className="flex-1 p-8 overflow-hidden bg-white">
                {activeTab === 'profile' && renderProfileTab()}
                {activeTab === 'models' && isAuthenticated && renderModelsTab()}
                {activeTab === 'characters' && isAuthenticated && renderCharactersTab()}
                {activeTab === 'users' && isAuthenticated && renderUsersTab()}
                {activeTab === 'cloud' && isAuthenticated && renderCloudTab()}
                {activeTab === 'notifications' && isAuthenticated && renderNotificationsTab()}
            </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-10">
           {exportedCode ? (
               <div className="flex-1 mr-4">
                   <input 
                      readOnly 
                      value="Code copied to clipboard (Simulated)" 
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-500 bg-gray-100"
                   />
                   {/* In real app, we would copy to clipboard here */}
               </div>
           ) : <div className="flex-1"></div>}
           
           <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">取消</button>
           <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="px-6 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-black transition-colors shadow-lg shadow-gray-200 disabled:opacity-50"
           >
              {isSaving ? '保存中...' : '保存更改'}
           </button>
        </div>

        {/* Export Code Modal Overlay */}
        {exportedCode && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-8 z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-full">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h3 className="font-medium">Export Configuration</h3>
                        <button onClick={() => setExportedCode(null)}>✕</button>
                    </div>
                    <textarea 
                        className="flex-1 p-4 font-mono text-xs bg-gray-50 resize-none focus:outline-none"
                        value={exportedCode}
                        readOnly
                    />
                    <div className="p-4 border-t text-right">
                        <button 
                            onClick={() => {navigator.clipboard.writeText(exportedCode); setExportedCode(null);}}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                        >
                            Copy & Close
                        </button>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
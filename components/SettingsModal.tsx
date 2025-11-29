
import React, { useState, useEffect } from 'react';
import { AppSettings, GeminiModelId, ProviderId, ProviderConfig, Persona, ModelOption, UserProfile } from '../types';
import { GEMINI_MODELS, MODEL_PROVIDERS } from '../constants';
import { generateRandomPersonaDetails } from '../services/geminiService';
import { uploadGlobalConfig, downloadGlobalConfig } from '../services/ossService';

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
}

type Tab = 'profile' | 'models' | 'characters' | 'users' | 'cloud';

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
  onAdminToggleBanIp
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  
  // Local state for edits
  const [localAvatar, setLocalAvatar] = useState(settings.userAvatar);
  const [localUserName, setLocalUserName] = useState(settings.userName || 'User');
  const [localGeminiModel, setLocalGeminiModel] = useState<GeminiModelId>(settings.geminiModel);
  const [localEnableThinking, setLocalEnableThinking] = useState(settings.enableThinking);
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

  // Local OSS Config
  const [localOssConfig, setLocalOssConfig] = useState(settings.ossConfig || {
      region: '', accessKeyId: '', accessKeySecret: '', bucket: '', path: '', enabled: false, autoSync: false
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
      setLocalActiveProvider(settings.activeProvider);
      setLocalProviderConfigs(settings.providerConfigs);
      setLocalPersonas(personas);
      setLocalAdminUsername(adminCredentials.username);
      setLocalAdminPassword(adminCredentials.password);
      if (settings.ossConfig) setLocalOssConfig(settings.ossConfig);
      setIsSaving(false);
    }
  }, [isOpen, settings, personas, adminCredentials]);

  // Reset tab if not authenticated and on restricted tab
  // Note: 'cloud' is available to everyone to INPUT keys, but Upload is Admin only.
  useEffect(() => {
      if (!isAuthenticated && (activeTab === 'models' || activeTab === 'characters' || activeTab === 'users')) {
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
      activeProvider: localActiveProvider,
      providerConfigs: localProviderConfigs,
      ossConfig: localOssConfig
    };
    
    // Update Local State
    onUpdateSettings(newSettings);
    
    // Only update personas/admin-creds if Admin
    if (isAuthenticated) {
        onUpdatePersonas(localPersonas);
        onUpdateAdminCredentials({ username: localAdminUsername, password: localAdminPassword });

        // Auto Upload to OSS if enabled
        if (localOssConfig.enabled) {
            setIsSaving(true);
            try {
                // Upload current state to cloud
                await uploadGlobalConfig(newSettings, localPersonas, localUserName);
                console.log('Auto-uploaded config to OSS');
            } catch (e) {
                console.error('Auto upload failed', e);
                // Alert user but don't prevent close, as local save succeeded
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
          activeProvider: localActiveProvider,
          providerConfigs: localProviderConfigs,
          bannedIps: settings.bannedIps,
          ossConfig: localOssConfig
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
          // Construct temp settings object for upload
          const tempSettings: AppSettings = {
              ...settings,
              providerConfigs: localProviderConfigs,
              activeProvider: localActiveProvider,
              geminiModel: localGeminiModel,
              enableThinking: localEnableThinking,
              ossConfig: localOssConfig
          };
          await uploadGlobalConfig(tempSettings, localPersonas, settings.userName);
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
          // Use local config for connection
          const tempSettings: AppSettings = { ...settings, ossConfig: localOssConfig };
          const data = await downloadGlobalConfig(tempSettings);
          
          if (data) {
              // Apply downloaded settings
              if (data.appSettings.providerConfigs) setLocalProviderConfigs(data.appSettings.providerConfigs as any);
              if (data.appSettings.activeProvider) setLocalActiveProvider(data.appSettings.activeProvider as any);
              if (data.appSettings.geminiModel) setLocalGeminiModel(data.appSettings.geminiModel as any);
              if (data.appSettings.enableThinking !== undefined) setLocalEnableThinking(data.appSettings.enableThinking);
              
              if (data.personas) setLocalPersonas(data.personas);
              
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


  // --- Character Logic ---
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
        
        // Random Provider/Model from constants (assuming all keys available, otherwise use defaults)
        const randomProvider = MODEL_PROVIDERS[Math.floor(Math.random() * MODEL_PROVIDERS.length)];
        const randomModel = randomProvider.models[Math.floor(Math.random() * randomProvider.models.length)];
        
        // Avatar
        const encodedPrompt = encodeURIComponent(details.avatarPrompt);
        const avatarUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=200&height=200&nologo=true`;

        // Update current editing persona
        setLocalPersonas(prev => prev.map(p => {
            if (p.id === editingPersonaId) {
                return {
                    ...p,
                    name: details.name,
                    role: randomModel.name, // Use Model Name as Role
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

  // --- User Logic ---
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
  
  const renderCloudTab = () => {
    // Check if using Env Vars
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
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Managed by Environment
                </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 relative">
                  {isEnvManaged && (
                    <div className="absolute top-0 right-0 p-2 opacity-50">
                       <svg className="w-16 h-16 text-blue-200" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    </div>
                  )}

                  <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
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
                              type="text" // changed from password to text for env display check
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
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="enableOss" className="ml-2 text-sm text-gray-700">启用云端同步 (Enable)</label>
                      </div>
                      <div className="flex items-center">
                          <input 
                            id="autoSync" 
                            type="checkbox" 
                            checked={localOssConfig.autoSync}
                            onChange={(e) => setLocalOssConfig({...localOssConfig, autoSync: e.target.checked})}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="autoSync" className="ml-2 text-sm text-gray-700">启动时自动拉取 (Auto Pull)</label>
                      </div>
                  </div>
              </div>
              
              <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-gray-800">同步操作</h4>
                  <div className="flex gap-4">
                      {isAuthenticated && (
                          <button 
                            onClick={handleUploadToOss}
                            disabled={isSyncing || !localOssConfig.enabled}
                            className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                              {isSyncing ? '...' : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                    上传配置 (Admin Push)
                                  </>
                              )}
                          </button>
                      )}
                      
                      <button 
                        onClick={handleDownloadFromOss}
                        disabled={isSyncing || !localOssConfig.enabled}
                        className="flex-1 border border-gray-300 bg-white text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                           {isSyncing ? '...' : (
                               <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3-3m3 3v12"></path></svg>
                                拉取配置 (Pull Sync)
                               </>
                           )}
                      </button>
                  </div>
                  
                  {syncStatus && (
                      <div className={`text-xs p-2 rounded ${syncStatus.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {syncStatus}
                      </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-2">
                      <p>注意：</p>
                      <ul className="list-disc list-inside space-y-1 mt-1 ml-1">
                          <li>上传操作将覆盖云端的 <code>{localOssConfig.path || 'config.json'}</code> 文件。</li>
                          <li>拉取操作将覆盖本地的“模型接入”和“角色管理”配置。</li>
                          {isEnvManaged && (
                              <li className="text-purple-600 font-medium">OSS 连接信息正由环境变量管理，普通用户打开应用时将自动拉取。</li>
                          )}
                      </ul>
                  </div>
              </div>
          </div>
      </div>
    );
  };

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
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded-full transition-all flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs">修改</span>
                </div>
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

  const renderModelsTab = () => (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
       <h3 className="text-lg font-medium text-gray-900">大模型接入配置 (Admin)</h3>
       <p className="text-xs text-gray-500 -mt-3">在此配置全局 API Key 和默认参数。所有用户的对话将使用此配置。</p>
       
       <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-6 pb-6">
           {MODEL_PROVIDERS.map(provider => {
             const isActive = localActiveProvider === provider.id;
             const config = localProviderConfigs[provider.id];
             const isGemini = provider.id === 'gemini';
             
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
                            placeholder={field.placeholder}
                            value={config[field.key as keyof ProviderConfig] as string || ''}
                            onChange={(e) => updateProviderConfig(provider.id, field.key as keyof ProviderConfig, e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        </div>
                    ))}

                    <div className="pt-1">
                        <div className="flex items-end gap-2 mb-1">
                            <label className="block text-xs font-medium text-gray-600">默认模型</label>
                            {provider.fields.length > 0 && (
                                <button 
                                    onClick={() => handleFetchModels(provider.id)}
                                    disabled={isFetchingModels[provider.id]}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                                >
                                    {isFetchingModels[provider.id] ? '获取中...' : '刷新/获取模型列表'}
                                </button>
                            )}
                        </div>
                        
                        <div className="relative">
                            <select 
                                value={config.selectedModel}
                                onChange={(e) => updateProviderConfig(provider.id, 'selectedModel', e.target.value)}
                                className="w-full text-xs border-gray-300 border rounded p-2 focus:ring-green-500 focus:border-green-500"
                            >
                                {availableModels.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                            {config.fetchedModels && config.fetchedModels.length > 0 && (
                                <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">API Fetched</span>
                                </div>
                            )}
                        </div>

                        {fetchError[provider.id] && (
                            <p className="text-[10px] text-red-500 mt-1">{fetchError[provider.id]}</p>
                        )}

                        {isGemini && (
                            <div className="flex items-center mt-2">
                                <input 
                                  id="thinking" 
                                  type="checkbox" 
                                  checked={localEnableThinking}
                                  onChange={(e) => setLocalEnableThinking(e.target.checked)}
                                  className="h-3 w-3 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                <label htmlFor="thinking" className="ml-2 block text-xs text-gray-600">
                                    启用思维链 (Thinking) - 仅限支持模型
                                </label>
                            </div>
                        )}
                    </div>

                 </div>
              </div>
             );
           })}
       </div>
    </div>
  );

  const renderCharactersTab = () => {
    const editingPersona = localPersonas.find(p => p.id === editingPersonaId);

    if (editingPersonaId && editingPersona) {
        // Edit Mode
        const currentProvider = editingPersona.config?.provider || 'gemini';
        const providerConfig = localProviderConfigs[currentProvider];
        
        const availableModels = providerConfig.fetchedModels && providerConfig.fetchedModels.length > 0
            ? providerConfig.fetchedModels
            : MODEL_PROVIDERS.find(p => p.id === currentProvider)?.models || [];

        return (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setEditingPersonaId(null)} className="p-1 hover:bg-gray-100 rounded">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <h3 className="text-lg font-medium text-gray-900">编辑角色: {editingPersona.name}</h3>
                    
                    {/* AI Generate Button */}
                    <button 
                        onClick={handleAIGeneratePersona}
                        disabled={isGeneratingPersona}
                        className="ml-auto text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="AI 自动生成头像、名称、人设和随机模型配置"
                    >
                       {isGeneratingPersona ? (
                           <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       ) : (
                           <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                       )}
                       AI 一键生成
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 flex items-center gap-4 mb-2">
                            <img src={editingPersona.avatar} className="w-16 h-16 rounded-md bg-gray-200 object-cover border" />
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-700 mb-1">头像 URL</label>
                                <input 
                                    type="text" 
                                    value={editingPersona.avatar}
                                    onChange={(e) => updatePersonaField(editingPersona.id, 'avatar', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">名称</label>
                            <input 
                                type="text" 
                                value={editingPersona.name}
                                onChange={(e) => updatePersonaField(editingPersona.id, 'name', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">角色标签 (Role)</label>
                            <input 
                                type="text" 
                                value={editingPersona.role}
                                onChange={(e) => updatePersonaField(editingPersona.id, 'role', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                            />
                        </div>
                     </div>

                     <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">人设指令 (System Instruction)</label>
                        <textarea 
                            value={editingPersona.systemInstruction}
                            onChange={(e) => updatePersonaField(editingPersona.id, 'systemInstruction', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-2 h-24 resize-none"
                            placeholder="你叫... 你的性格是..."
                        />
                     </div>

                     <div className="border-t border-gray-100 my-4"></div>

                     <div>
                        <h4 className="text-sm font-semibold text-gray-800 mb-3">模型配置</h4>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">服务提供商</label>
                                <select 
                                    value={currentProvider}
                                    onChange={(e) => updatePersonaConfig(editingPersona.id, 'provider', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                                >
                                    {MODEL_PROVIDERS.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">选择模型</label>
                                <select 
                                    value={editingPersona.config?.modelId}
                                    onChange={(e) => updatePersonaConfig(editingPersona.id, 'modelId', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-2"
                                >
                                    {availableModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                             </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            * 如使用自定义模型，请确保在“模型接入”中已获取模型列表。
                        </p>
                     </div>
                </div>
            </div>
        );
    }

    // List Mode
    return (
        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">角色管理 (Admin)</h3>
                    <p className="text-xs text-gray-500">创建并配置参与讨论的 AI 角色。</p>
                </div>
                <button 
                  onClick={handleAddPersona}
                  className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded flex items-center"
                >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    新建角色
                </button>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 gap-3 pb-4">
                 {localPersonas.map(persona => {
                    const providerInfo = MODEL_PROVIDERS.find(p => p.id === (persona.config?.provider || 'gemini'));
                    return (
                        <div key={persona.id} className="flex items-center p-3 border border-gray-200 rounded-lg bg-white hover:border-green-300 transition-colors group">
                            <img src={persona.avatar} alt={persona.name} className="w-10 h-10 rounded-md object-cover bg-gray-100" />
                            <div className="ml-3 flex-1 min-w-0">
                                <div className="flex items-baseline">
                                    <h4 className="text-sm font-medium text-gray-900 truncate mr-2">{persona.name}</h4>
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">{persona.role}</span>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                    <img src={providerInfo?.icon} className="w-3 h-3 rounded-full" />
                                    <span>{providerInfo?.name} / {persona.config?.modelId || 'Default'}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => setEditingPersonaId(persona.id)}
                                    className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                    title="编辑"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                </button>
                                <button 
                                    onClick={() => handleDeletePersona(persona.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="删除"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        </div>
                    );
                 })}
             </div>
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-[180px] bg-gray-50 border-r border-gray-200 flex flex-col pt-6 pb-4 flex-shrink-0">
            <div className="px-6 mb-8">
                <h2 className="text-lg font-bold text-gray-800">设置</h2>
                {!isAuthenticated && (
                    <p className="text-[10px] text-gray-400 mt-1">普通用户模式</p>
                )}
            </div>
            
            <nav className="flex-1 space-y-1 px-3">
                <button 
                  onClick={() => setActiveTab('profile')}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'profile' 
                      ? 'bg-white text-green-600 shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                    个人资料
                </button>
                
                {/* Available to everyone to set up Sync */}
                <button 
                    onClick={() => setActiveTab('cloud')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'cloud' 
                        ? 'bg-white text-green-600 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                    <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    云端同步
                </button>
                
                {isAuthenticated && (
                    <>
                    <button 
                    onClick={() => setActiveTab('models')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'models' 
                        ? 'bg-white text-green-600 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    >
                        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        模型接入
                    </button>
                    
                    <button 
                    onClick={() => setActiveTab('characters')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'characters' 
                        ? 'bg-white text-green-600 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    >
                        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        角色管理
                    </button>

                    <button 
                    onClick={() => setActiveTab('users')}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'users' 
                        ? 'bg-white text-green-600 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                    >
                        <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                        用户管理
                    </button>
                    </>
                )}
            </nav>

            <div className="px-6 mt-auto">
                <div className="text-xs text-gray-400">
                    Version 1.5.0
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Header / Close */}
            <div className="flex justify-end p-4">
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 px-8 pb-8 overflow-hidden flex flex-col">
                <>
                    {activeTab === 'profile' && renderProfileTab()}
                    {activeTab === 'cloud' && renderCloudTab()}
                    {activeTab === 'models' && isAuthenticated && renderModelsTab()}
                    {activeTab === 'characters' && isAuthenticated && renderCharactersTab()}
                    {activeTab === 'users' && isAuthenticated && renderUsersTab()}
                </>
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                <button 
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                >
                    取消
                </button>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] shadow-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                >
                    {isSaving && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    )}
                    {isSaving ? '保存并上传...' : '保存设置'}
                </button>
            </div>
            
            {/* Export Code Modal Overlay */}
            {exportedCode && (
                <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-full">
                         <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                             <h3 className="font-bold text-gray-800">默认配置代码 (Deployment Defaults)</h3>
                             <button onClick={() => setExportedCode(null)} className="text-gray-500 hover:text-gray-700">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                             </button>
                         </div>
                         <div className="p-4 flex-1 overflow-hidden relative">
                             <p className="text-xs text-gray-500 mb-2">请复制下方代码，覆盖项目文件 <code>constants.ts</code> 中的 <code>DEFAULT_APP_SETTINGS</code> 变量。重新构建部署后，此配置将成为所有新用户的默认设置。</p>
                             <textarea 
                                readOnly
                                value={exportedCode}
                                className="w-full h-[300px] font-mono text-xs bg-gray-50 border border-gray-200 rounded p-3 focus:outline-none resize-none"
                                onClick={(e) => e.currentTarget.select()}
                             />
                         </div>
                         <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                             <button 
                                onClick={() => setExportedCode(null)}
                                className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded"
                             >
                                 关闭
                             </button>
                             <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(exportedCode);
                                    alert("已复制到剪贴板！");
                                }}
                                className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded"
                             >
                                 复制代码
                             </button>
                         </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

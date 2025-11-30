
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
  const [newPersona, setNewPersona] = useState<Partial<Persona>>({});
  
  // Drag and Drop State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

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

  const [exportedCode, setExportedCode] = useState<string | null>(null);

  // User Management State
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
  
  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    // Use default drag image or customize if needed
    // e.dataTransfer.effectAllowed = "move"; 
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    // e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newPersonas = [...localPersonas];
    const draggedItem = newPersonas[draggedItemIndex];
    
    // Remove from old index
    newPersonas.splice(draggedItemIndex, 1);
    // Insert at new index
    newPersonas.splice(index, 0, draggedItem);
    
    setLocalPersonas(newPersonas);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
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
          await uploadGlobalConfig(tempSettings, localPersonas, allUsers || [], tempAdminCreds, localUserName);
          setSyncStatus('上传成功');
          setTimeout(() => setSyncStatus(''), 2000);
      } catch (e) {
          console.error('Upload failed', e);
          setSyncStatus('上传失败');
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDownloadFromOss = async () => {
      if (!isAuthenticated) return;
      setIsSyncing(true);
      setSyncStatus('正在下载配置...');
      try {
          const config = await downloadGlobalConfig({...settings, ossConfig: localOssConfig});
          if (config) {
              if (config.appSettings) {
                   setLocalProviderConfigs(config.appSettings.providerConfigs || localProviderConfigs);
                   setLocalActiveProvider(config.appSettings.activeProvider || localActiveProvider);
                   setLocalGeminiModel(config.appSettings.geminiModel || localGeminiModel);
                   setLocalEnableThinking(config.appSettings.enableThinking ?? localEnableThinking);
                   if (config.appSettings.notificationConfig) setLocalNotificationConfig(config.appSettings.notificationConfig);
              }
              if (config.personas) {
                  setLocalPersonas(config.personas);
              }
              if (config.adminAuth) {
                  setLocalAdminUsername(config.adminAuth.username);
                  setLocalAdminPassword(config.adminAuth.password);
              }
              setSyncStatus('下载成功 (未保存)');
          } else {
              setSyncStatus('云端无配置');
          }
          setTimeout(() => setSyncStatus(''), 2000);
      } catch (e) {
          console.error("Download failed", e);
          setSyncStatus('下载失败');
      } finally {
          setIsSyncing(false);
      }
  };

  // --- Persona Management ---
  const handleAddPersona = () => {
    const id = `persona_${Date.now()}`;
    const newP: Persona = {
        id,
        name: '新角色',
        role: 'Assistant',
        avatar: `https://ui-avatars.com/api/?name=New&background=random`,
        systemInstruction: '你是一个乐于助人的AI助手。',
        color: 'text-gray-600',
        config: { provider: 'gemini', modelId: 'gemini-2.5-flash' },
        ...newPersona
    };
    setLocalPersonas([...localPersonas, newP]);
    setEditingPersonaId(id);
    setNewPersona({});
  };

  const handleDeletePersona = (id: string) => {
    if (window.confirm("Delete this persona?")) {
        setLocalPersonas(prev => prev.filter(p => p.id !== id));
        if (editingPersonaId === id) setEditingPersonaId(null);
    }
  };
  
  const handleAutoGeneratePersona = async () => {
      setIsGeneratingPersona(true);
      try {
          const details = await generateRandomPersonaDetails(settings);
          
          const id = `persona_${Date.now()}`;
          let avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(details.name)}&background=random`;
          
          if (details.avatarPrompt) {
             const encoded = encodeURIComponent(details.avatarPrompt);
             avatarUrl = `https://image.pollinations.ai/prompt/${encoded}?width=200&height=200&nologo=true`;
          }

          const newP: Persona = {
              id,
              name: details.name,
              role: details.role,
              avatar: avatarUrl,
              systemInstruction: details.systemInstruction,
              color: 'text-blue-600',
              config: { provider: 'gemini', modelId: 'gemini-2.5-flash' }
          };
          setLocalPersonas([...localPersonas, newP]);
          setEditingPersonaId(id);
      } catch (e) {
          console.error(e);
          alert("生成失败");
      } finally {
          setIsGeneratingPersona(false);
      }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        
        {/* Sidebar */}
        <div className="w-[200px] bg-gray-50 border-r border-gray-100 flex flex-col p-4">
           <h2 className="text-sm font-bold text-gray-500 uppercase mb-4 px-2">Settings</h2>
           <div className="space-y-1">
               <button onClick={() => setActiveTab('profile')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'profile' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                   个人资料
               </button>
               {isAuthenticated && (
                   <>
                    <button onClick={() => setActiveTab('models')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'models' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                        模型接入
                    </button>
                    <button onClick={() => setActiveTab('characters')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'characters' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                        角色管理
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'users' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                        用户管理
                    </button>
                    <button onClick={() => setActiveTab('cloud')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'cloud' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                        云端同步
                    </button>
                    <button onClick={() => setActiveTab('notifications')} className={`w-full text-left px-3 py-2 rounded text-sm ${activeTab === 'notifications' ? 'bg-white shadow-sm text-green-600 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
                        通知推送
                    </button>
                   </>
               )}
           </div>
           
           <div className="mt-auto border-t border-gray-200 pt-4 space-y-2">
               <button onClick={onSwitchUser} className="w-full text-left px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                   切换账号
               </button>
               <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                   退出登录
               </button>
           </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                
                {/* Profile Tab */}
                {activeTab === 'profile' && (
                    <div className="space-y-6 max-w-lg">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">个人资料</h3>
                        
                        <div className="flex items-center gap-4">
                            <img src={localAvatar} alt="Avatar" className="w-16 h-16 rounded-lg bg-gray-100 object-cover" />
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-gray-500 mb-1">头像 URL</label>
                                <input 
                                    type="text" 
                                    value={localAvatar}
                                    onChange={(e) => setLocalAvatar(e.target.value)}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                            <input 
                                type="text" 
                                value={localUserName}
                                onChange={(e) => setLocalUserName(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                            />
                        </div>

                        <div className="pt-4 border-t">
                            <h4 className="text-sm font-medium text-gray-900 mb-3">全局默认设置 (Fallback)</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">默认 AI 提供商</label>
                                    <select 
                                        value={localActiveProvider}
                                        onChange={(e) => setLocalActiveProvider(e.target.value as ProviderId)}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    >
                                        {MODEL_PROVIDERS.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">回复字数限制</label>
                                    <input 
                                        type="number" 
                                        value={localMaxReplyLength}
                                        onChange={(e) => setLocalMaxReplyLength(Number(e.target.value))}
                                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox"
                                        id="thinking"
                                        checked={localEnableThinking}
                                        onChange={(e) => setLocalEnableThinking(e.target.checked)}
                                        className="rounded text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor="thinking" className="text-sm text-gray-700">启用思维链 (Thinking Process) - 仅限支持模型</label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Models Tab */}
                {activeTab === 'models' && isAuthenticated && (
                    <div className="space-y-8">
                         <h3 className="text-lg font-medium text-gray-900 border-b pb-2">模型接入配置</h3>
                         
                         {MODEL_PROVIDERS.map(provider => (
                             <div key={provider.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                 <div className="flex items-center gap-2 mb-4">
                                     <img src={provider.icon} className="w-6 h-6 rounded-full" />
                                     <h4 className="font-medium text-gray-900">{provider.name}</h4>
                                     {localActiveProvider === provider.id && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">当前默认</span>}
                                 </div>
                                 
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {provider.fields.map(field => (
                                         <div key={field.key}>
                                             <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                                             <input 
                                                 type={field.type}
                                                 placeholder={field.placeholder}
                                                 value={localProviderConfigs[provider.id]?.[field.key] || ''}
                                                 onChange={(e) => updateProviderConfig(provider.id, field.key, e.target.value)}
                                                 className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500"
                                             />
                                         </div>
                                     ))}
                                     <div>
                                         <label className="block text-xs font-medium text-gray-500 mb-1">默认模型</label>
                                         <select 
                                            value={localProviderConfigs[provider.id]?.selectedModel}
                                            onChange={(e) => updateProviderConfig(provider.id, 'selectedModel', e.target.value)}
                                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                                         >
                                             {provider.models.map(m => (
                                                 <option key={m.id} value={m.id}>{m.name}</option>
                                             ))}
                                         </select>
                                     </div>
                                 </div>
                             </div>
                         ))}

                         <div className="pt-4">
                            <button onClick={handleExportDefaults} className="text-xs text-blue-600 underline">导出当前配置为代码 (constants.ts)</button>
                            {exportedCode && (
                                <textarea readOnly className="w-full h-32 mt-2 text-xs font-mono bg-gray-800 text-green-400 p-2 rounded" value={exportedCode} />
                            )}
                         </div>
                    </div>
                )}

                {/* Characters Tab (Drag and Drop Added) */}
                {activeTab === 'characters' && isAuthenticated && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center border-b pb-2">
                             <h3 className="text-lg font-medium text-gray-900">角色管理</h3>
                             <div className="flex gap-2">
                                <button 
                                    onClick={handleAutoGeneratePersona} 
                                    disabled={isGeneratingPersona}
                                    className="px-3 py-1.5 text-xs bg-purple-50 text-purple-600 border border-purple-200 rounded hover:bg-purple-100 flex items-center gap-1"
                                >
                                    {isGeneratingPersona ? '生成中...' : 'AI 生成角色'}
                                </button>
                                <button onClick={handleAddPersona} className="px-3 py-1.5 text-xs bg-green-50 text-green-600 border border-green-200 rounded hover:bg-green-100">
                                    + 手动添加
                                </button>
                             </div>
                        </div>

                        <div className="space-y-2">
                            {localPersonas.map((persona, index) => (
                                <div 
                                    key={persona.id} 
                                    className={`border border-gray-200 rounded-lg p-3 bg-white flex items-start gap-3 hover:shadow-sm transition-all ${
                                        draggedItemIndex === index ? 'opacity-40 border-dashed border-gray-400 bg-gray-50' : ''
                                    }`}
                                    draggable={!editingPersonaId} // Disable drag when editing is active to avoid conflicts
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={(e) => handleDragOver(e, index)}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {/* Drag Handle */}
                                    <div className={`mt-2 text-gray-400 ${editingPersonaId ? 'opacity-30 cursor-not-allowed' : 'hover:text-gray-600 cursor-move'}`}>
                                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
                                    </div>

                                    <img src={persona.avatar} className="w-10 h-10 rounded bg-gray-200 object-cover flex-shrink-0" />
                                    
                                    <div className="flex-1 min-w-0">
                                        {editingPersonaId === persona.id ? (
                                            <div className="space-y-2">
                                                <div className="flex gap-2">
                                                    <input 
                                                        className="border rounded px-2 py-1 text-sm w-1/3" 
                                                        value={persona.name} 
                                                        onChange={(e) => setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, name: e.target.value} : p))}
                                                        placeholder="Name"
                                                    />
                                                    <input 
                                                        className="border rounded px-2 py-1 text-sm w-1/3" 
                                                        value={persona.role} 
                                                        onChange={(e) => setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, role: e.target.value} : p))}
                                                        placeholder="Role"
                                                    />
                                                    <input 
                                                        className="border rounded px-2 py-1 text-sm w-1/3 font-mono" 
                                                        value={persona.avatar} 
                                                        onChange={(e) => setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, avatar: e.target.value} : p))}
                                                        placeholder="Avatar URL"
                                                    />
                                                </div>
                                                <textarea 
                                                    className="w-full border rounded px-2 py-1 text-xs h-16"
                                                    value={persona.systemInstruction}
                                                    onChange={(e) => setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, systemInstruction: e.target.value} : p))}
                                                    placeholder="System Instruction"
                                                />
                                                <div className="flex gap-2 items-center">
                                                    <select 
                                                        className="border rounded px-2 py-1 text-xs"
                                                        value={persona.config?.provider || 'gemini'}
                                                        onChange={(e) => {
                                                            const provider = e.target.value as ProviderId;
                                                            const defaultModel = MODEL_PROVIDERS.find(mp => mp.id === provider)?.models[0].id || '';
                                                            setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, config: { provider, modelId: defaultModel }} : p));
                                                        }}
                                                    >
                                                        {MODEL_PROVIDERS.map(mp => <option key={mp.id} value={mp.id}>{mp.name}</option>)}
                                                    </select>
                                                    
                                                    <select 
                                                        className="border rounded px-2 py-1 text-xs"
                                                        value={persona.config?.modelId}
                                                        onChange={(e) => setLocalPersonas(prev => prev.map(p => p.id === persona.id ? {...p, config: {...p.config, modelId: e.target.value} as any} : p))}
                                                    >
                                                        {MODEL_PROVIDERS.find(mp => mp.id === (persona.config?.provider || 'gemini'))?.models.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>

                                                    <button onClick={() => setEditingPersonaId(null)} className="ml-auto text-xs bg-green-500 text-white px-3 py-1 rounded">完成</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className="font-medium text-sm text-gray-900">{persona.name}</span>
                                                        <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-1 rounded">{persona.role}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-50 px-1.5 rounded border">
                                                            <span>{persona.config?.provider}</span>
                                                            <span>/</span>
                                                            <span>{persona.config?.modelId}</span>
                                                        </div>
                                                        <button onClick={() => setEditingPersonaId(persona.id)} className="text-gray-400 hover:text-blue-500 p-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                        </button>
                                                        <button onClick={() => handleDeletePersona(persona.id)} className="text-gray-400 hover:text-red-500 p-1">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{persona.systemInstruction}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && isAuthenticated && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">用户管理 (Admin)</h3>
                        
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-lg mb-6">
                            <h4 className="text-sm font-medium text-orange-800 mb-2">管理员凭证</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <input 
                                    type="text"
                                    value={localAdminUsername}
                                    onChange={(e) => setLocalAdminUsername(e.target.value)}
                                    placeholder="Username"
                                    className="border rounded px-3 py-1.5 text-sm"
                                />
                                <input 
                                    type="password"
                                    value={localAdminPassword}
                                    onChange={(e) => setLocalAdminPassword(e.target.value)}
                                    placeholder="Password"
                                    className="border rounded px-3 py-1.5 text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                             <h4 className="text-sm font-medium text-gray-700">已注册用户 ({allUsers?.length || 0})</h4>
                             <div className="max-h-[300px] overflow-y-auto border rounded-lg divide-y">
                                 {allUsers?.map(user => (
                                     <div key={user.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                                         <div className="flex items-center gap-3">
                                             <img src={user.avatar} className="w-8 h-8 rounded bg-gray-200" />
                                             <div>
                                                 <div className="text-sm font-medium">{user.name} {user.id === 'admin_root' && <span className="text-xs bg-gray-200 px-1 rounded">System</span>}</div>
                                                 <div className="text-xs text-gray-400">ID: {user.id} | IP: {user.lastIp || 'N/A'}</div>
                                             </div>
                                         </div>
                                         {user.id !== 'admin_root' && (
                                             <div className="flex items-center gap-2">
                                                 <button 
                                                    onClick={() => onAdminToggleBanIp?.(user.lastIp || '')}
                                                    className={`text-xs px-2 py-1 rounded border ${settings.bannedIps.includes(user.lastIp || '') ? 'bg-red-100 text-red-600 border-red-200' : 'bg-white text-gray-600 border-gray-200'}`}
                                                 >
                                                     {settings.bannedIps.includes(user.lastIp || '') ? 'Unban IP' : 'Ban IP'}
                                                 </button>
                                                 <button 
                                                    onClick={() => { if(window.confirm('Delete user data?')) onAdminDeleteUser?.(user.id) }}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                 >
                                                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                 </button>
                                             </div>
                                         )}
                                     </div>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}

                {/* Cloud Tab */}
                {activeTab === 'cloud' && isAuthenticated && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">阿里云 OSS 同步</h3>
                        <p className="text-xs text-gray-500">配置 OSS 后，系统配置、角色和用户数据将在不同设备间自动同步。</p>

                        <div className="flex items-center gap-2 mb-4">
                            <input 
                                type="checkbox"
                                id="ossEnabled"
                                checked={localOssConfig.enabled}
                                onChange={(e) => setLocalOssConfig(prev => ({...prev, enabled: e.target.checked}))}
                                className="rounded text-green-600 focus:ring-green-500"
                            />
                            <label htmlFor="ossEnabled" className="text-sm font-medium text-gray-900">启用云端同步</label>
                        </div>

                        {localOssConfig.enabled && (
                            <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Region</label>
                                        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="oss-cn-hangzhou" value={localOssConfig.region} onChange={e => setLocalOssConfig(p => ({...p, region: e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Bucket</label>
                                        <input className="w-full border rounded px-3 py-2 text-sm" placeholder="my-app-data" value={localOssConfig.bucket} onChange={e => setLocalOssConfig(p => ({...p, bucket: e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">AccessKey ID</label>
                                        <input type="password" className="w-full border rounded px-3 py-2 text-sm" value={localOssConfig.accessKeyId} onChange={e => setLocalOssConfig(p => ({...p, accessKeyId: e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">AccessKey Secret</label>
                                        <input type="password" className="w-full border rounded px-3 py-2 text-sm" value={localOssConfig.accessKeySecret} onChange={e => setLocalOssConfig(p => ({...p, accessKeySecret: e.target.value}))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Config Path</label>
                                    <input className="w-full border rounded px-3 py-2 text-sm" placeholder="ai-roundtable/config.json" value={localOssConfig.path} onChange={e => setLocalOssConfig(p => ({...p, path: e.target.value}))} />
                                </div>
                                
                                <div className="flex items-center gap-2 mt-2">
                                     <input 
                                        type="checkbox"
                                        id="autoSync"
                                        checked={localOssConfig.autoSync}
                                        onChange={(e) => setLocalOssConfig(prev => ({...prev, autoSync: e.target.checked}))}
                                        className="rounded text-green-600 focus:ring-green-500"
                                    />
                                    <label htmlFor="autoSync" className="text-xs text-gray-600">自动同步 (打开网页时自动下载，保存设置时自动上传)</label>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4 pt-2">
                            <button 
                                onClick={handleDownloadFromOss}
                                disabled={isSyncing || !localOssConfig.enabled}
                                className="px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 disabled:opacity-50 text-sm flex items-center gap-2"
                            >
                                {isSyncing ? '...' : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>}
                                手动下载配置
                            </button>
                            <button 
                                onClick={handleUploadToOss}
                                disabled={isSyncing || !localOssConfig.enabled}
                                className="px-4 py-2 bg-green-50 text-green-600 border border-green-200 rounded hover:bg-green-100 disabled:opacity-50 text-sm flex items-center gap-2"
                            >
                                {isSyncing ? '...' : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3 3m0 0l-3 3m3-3v12"></path></svg>}
                                手动上传配置
                            </button>
                        </div>
                        {syncStatus && <p className="text-xs text-gray-500">{syncStatus}</p>}
                    </div>
                )}
                
                {/* Notifications Tab */}
                {activeTab === 'notifications' && isAuthenticated && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-medium text-gray-900 border-b pb-2">通知推送 (Bark)</h3>
                        <p className="text-xs text-gray-500">集成 Bark App 实现 iOS 设备实时通知 (例如新用户注册)。</p>
                        
                        <div className="flex items-center gap-2 mb-4">
                            <input 
                                type="checkbox"
                                id="notifEnabled"
                                checked={localNotificationConfig.enabled}
                                onChange={(e) => setLocalNotificationConfig(prev => ({...prev, enabled: e.target.checked}))}
                                className="rounded text-green-600 focus:ring-green-500"
                            />
                            <label htmlFor="notifEnabled" className="text-sm font-medium text-gray-900">启用推送</label>
                        </div>

                         <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Bark Server URL</label>
                                <input 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                    placeholder="https://api.day.app" 
                                    value={localNotificationConfig.serverUrl} 
                                    onChange={e => setLocalNotificationConfig(p => ({...p, serverUrl: e.target.value}))} 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Device Key</label>
                                <input 
                                    className="w-full border rounded px-3 py-2 text-sm" 
                                    placeholder="Your Bark Key" 
                                    value={localNotificationConfig.deviceKey} 
                                    onChange={e => setLocalNotificationConfig(p => ({...p, deviceKey: e.target.value}))} 
                                />
                            </div>
                            
                            <button 
                                onClick={() => sendBarkNotification('Test Notification', 'Bark integration is working!', localNotificationConfig)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                            >
                                发送测试通知
                            </button>
                         </div>
                    </div>
                )}

            </div>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
                <button onClick={handleSave} className="px-6 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] shadow-sm">
                    {isSaving ? '保存中...' : '保存更改'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

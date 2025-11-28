
import React, { useState, useEffect } from 'react';
import { AppSettings, GeminiModelId, ProviderId, ProviderConfig, Persona, ModelOption } from '../types';
import { GEMINI_MODELS, MODEL_PROVIDERS } from '../constants';
import { SyncService } from '../services/syncService';

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
}

type Tab = 'profile' | 'models' | 'characters' | 'cloud';

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
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Local state for edits
  const [localAvatar, setLocalAvatar] = useState(settings.userAvatar);
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

  const [isFetchingModels, setIsFetchingModels] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<Record<string, string>>({});

  // Sync Tab State
  const [inputSyncCode, setInputSyncCode] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  const [loginStatus, setLoginStatus] = useState<'idle' | 'checking' | 'restoring'>('idle');
  const [error, setError] = useState('');

  // Sync props to local state when opening
  useEffect(() => {
    if (isOpen) {
      setLocalAvatar(settings.userAvatar);
      setLocalGeminiModel(settings.geminiModel);
      setLocalEnableThinking(settings.enableThinking);
      setLocalActiveProvider(settings.activeProvider);
      setLocalProviderConfigs(settings.providerConfigs);
      setLocalPersonas(personas);
      setLocalAdminUsername(adminCredentials.username);
      setLocalAdminPassword(adminCredentials.password);
      
      // Reset Login State
      setUsername('');
      setPassword('');
      setError('');
      setLoginStatus('idle');
    }
  }, [isOpen, settings, personas, adminCredentials]);

  if (!isOpen) return null;

  const handleLogin = async () => {
    setLoginStatus('checking');
    setError('');

    // 1. Try Local Login
    if (username === adminCredentials.username && password === adminCredentials.password) {
      onLoginSuccess();
      setLoginStatus('idle');
      return;
    } 
    
    // 2. Try Smart Cloud Login (Treat password as Sync Code)
    // UUID-like strings (simple check)
    if (password.length > 20) {
        try {
            setLoginStatus('restoring');
            const data = await SyncService.get(password.trim());
            if (data) {
                // Restore Data
                if (data.settings) onUpdateSettings({ ...data.settings, syncCode: password.trim() });
                if (data.personas) onUpdatePersonas(data.personas);
                if (data.adminCredentials) onUpdateAdminCredentials(data.adminCredentials);
                
                // Success
                onLoginSuccess();
                alert('云端数据已恢复，自动同步已开启。');
                return;
            }
        } catch (e) {
            console.error(e);
            // Fall through to error
        }
    }

    setLoginStatus('idle');
    setError('用户名或密码错误 (或无效的同步码)');
  };

  const handleSave = () => {
    onUpdateSettings({
      ...settings,
      userAvatar: localAvatar,
      geminiModel: localGeminiModel,
      enableThinking: localEnableThinking,
      activeProvider: localActiveProvider,
      providerConfigs: localProviderConfigs
    });
    onUpdatePersonas(localPersonas);
    onUpdateAdminCredentials({ username: localAdminUsername, password: localAdminPassword });
    onClose();
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

  const handleFetchModels = async (providerId: ProviderId) => {
    const config = localProviderConfigs[providerId];
    if (!config.baseUrl || !config.apiKey) {
      setFetchError(prev => ({ ...prev, [providerId]: '需填写 Base URL 和 API Key' }));
      return;
    }

    setIsFetchingModels(prev => ({ ...prev, [providerId]: true }));
    setFetchError(prev => ({ ...prev, [providerId]: '' }));

    try {
      // Clean URL: remove trailing slash
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

      // OpenAI compatible standard: { data: [{ id: '...', ... }] }
      if (data.data && Array.isArray(data.data)) {
        models = data.data.map((m: any) => ({
          id: m.id,
          name: m.id // Use ID as name if name not present
        }));
      } else {
         throw new Error('Unrecognized response format');
      }

      if (models.length === 0) {
         throw new Error('No models found');
      }

      // Update local config with fetched models
      updateProviderConfig(providerId, 'fetchedModels', models);
      
      setFetchError(prev => ({ ...prev, [providerId]: '' })); // clear error
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
                // If provider changes, reset model to first one of that provider
                ...(field === 'provider' ? { modelId: MODEL_PROVIDERS.find(prov => prov.id === value)?.models[0].id || '' } : {})
            } 
        } : p
    ));
  };

  // --- Sync Logic ---
  const handleStartSync = async () => {
      setSyncStatus('loading');
      setSyncMessage('正在创建云端存储...');
      try {
          const payload = {
              settings,
              personas,
              adminCredentials,
              timestamp: Date.now()
          };
          const id = await SyncService.create(payload);
          onUpdateSettings({ ...settings, syncCode: id });
          setSyncStatus('success');
          setSyncMessage('云端同步已开启');
      } catch (e) {
          console.error(e);
          setSyncStatus('error');
          setSyncMessage('开启同步失败，请重试');
      }
  };

  const handleConnectSync = async () => {
      if (!inputSyncCode.trim()) return;
      setSyncStatus('loading');
      setSyncMessage('正在获取云端数据...');
      try {
          const data = await SyncService.get(inputSyncCode.trim());
          if (data) {
              // Confirm overwrite
              if (window.confirm('找到云端存档。这将覆盖当前浏览器的设置和角色，确定继续吗？')) {
                  onUpdateSettings({ ...data.settings, syncCode: inputSyncCode.trim() });
                  if (data.personas) onUpdatePersonas(data.personas);
                  if (data.adminCredentials) onUpdateAdminCredentials(data.adminCredentials);
                  setSyncStatus('success');
                  setSyncMessage('同步连接成功，数据已拉取');
              } else {
                  setSyncStatus('idle');
                  setSyncMessage('');
              }
          }
      } catch (e) {
          console.error(e);
          setSyncStatus('error');
          setSyncMessage('连接失败：无效的同步码或网络错误');
      }
  };

  const handleDisconnectSync = () => {
      if (window.confirm('确定断开云同步吗？本地数据将保留，但不会再自动上传。')) {
          onUpdateSettings({ ...settings, syncCode: undefined });
          setSyncStatus('idle');
          setSyncMessage('');
          setInputSyncCode('');
      }
  };

  const handleForcePull = async () => {
      if (!settings.syncCode) return;
      setSyncStatus('loading');
      try {
          const data = await SyncService.get(settings.syncCode);
          if (data) {
              onUpdateSettings({ ...data.settings, syncCode: settings.syncCode });
              if (data.personas) onUpdatePersonas(data.personas);
              if (data.adminCredentials) onUpdateAdminCredentials(data.adminCredentials);
              setSyncStatus('success');
              setSyncMessage('手动拉取成功');
              setTimeout(() => setSyncMessage(''), 3000);
          }
      } catch (e) {
          setSyncStatus('error');
          setSyncMessage('拉取失败');
      }
  };

  const renderLogin = () => {
    return (
        <div className="flex flex-col h-full justify-center animate-in fade-in slide-in-from-left-4 duration-300">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-800 p-4 rounded-lg text-sm mb-6 flex flex-col gap-1 border border-blue-100 shadow-sm">
            <div className="flex items-center font-medium">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                后台登录 / 云端同步
            </div>
            <p className="text-xs text-blue-600/80 pl-6">
                更换设备？请在下方密码栏直接粘贴您的 <b>同步码</b> 即可自动恢复数据。
            </p>
        </div>

        <div className="space-y-5">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
            <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="请输入账号"
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码 / Sync Code</label>
            <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                placeholder="请输入密码 / 云端同步码"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            </div>
            
            {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
            
            <button 
                onClick={handleLogin}
                disabled={loginStatus !== 'idle'}
                className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors font-medium mt-2 shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
            >
                {loginStatus !== 'idle' ? (
                   <>
                     <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                     {loginStatus === 'restoring' ? '正在从云端恢复...' : '验证中...'}
                   </>
                ) : '登录'}
            </button>
        </div>
        </div>
    );
  };

  const renderProfileTab = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">个人资料</h3>
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
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">头像链接 (URL)</label>
              <input 
                type="text" 
                value={localAvatar}
                onChange={(e) => setLocalAvatar(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                placeholder="https://..."
              />
              <p className="text-xs text-gray-400 mt-1">支持 JPG, PNG, WEBP 等图片链接</p>
            </div>

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
                        placeholder="请输入账号"
                    />
                  </div>
                   <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">密码</label>
                    <input 
                        type="text" 
                        value={localAdminPassword}
                        onChange={(e) => setLocalAdminPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                        placeholder="请输入密码"
                    />
                  </div>
                  <div className="text-[10px] text-orange-600 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                      修改此处将更新登录后台所需的凭证
                  </div>
               </div>
            </div>
        </div>
    </div>
  );

  const renderModelsTab = () => (
    <div className="space-y-6 h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
       <h3 className="text-lg font-medium text-gray-900">大模型接入配置</h3>
       <p className="text-xs text-gray-500 -mt-3">在此配置 API Key 和默认参数。点击“获取模型”可从 URL 拉取可用列表。</p>
       
       <div className="overflow-y-auto custom-scrollbar flex-1 pr-1 space-y-6 pb-6">
           {MODEL_PROVIDERS.map(provider => {
             const isActive = localActiveProvider === provider.id;
             const config = localProviderConfigs[provider.id];
             const isGemini = provider.id === 'gemini';
             
             // Use fetched models if available, otherwise default static list
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
                 {/* Header */}
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

                 {/* Inputs */}
                 <div className={`space-y-3`}>
                    
                    {/* API Fields */}
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

                    {/* Model Fetching & Selection */}
                    <div className="pt-1">
                        <div className="flex items-end gap-2 mb-1">
                            <label className="block text-xs font-medium text-gray-600">默认模型</label>
                            
                            {/* Fetch Button (Only if URL/Key fields exist) */}
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
                            {/* Indicator for fetched models */}
                            {config.fetchedModels && config.fetchedModels.length > 0 && (
                                <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">API Fetched</span>
                                </div>
                            )}
                        </div>

                        {/* Error Message */}
                        {fetchError[provider.id] && (
                            <p className="text-[10px] text-red-500 mt-1">{fetchError[provider.id]}</p>
                        )}

                        {/* Gemini Thinking Checkbox */}
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
        
        // Dynamic model list for the persona dropdown
        const availableModels = providerConfig.fetchedModels && providerConfig.fetchedModels.length > 0
            ? providerConfig.fetchedModels
            : MODEL_PROVIDERS.find(p => p.id === currentProvider)?.models || [];

        return (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-2 mb-4">
                    <button onClick={() => setEditingPersonaId(null)} className="p-1 hover:bg-gray-100 rounded">
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    <h3 className="text-lg font-medium text-gray-900">编辑角色: {editingPersona.name}</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                    {/* Role Basic Info */}
                    <div className="flex gap-4">
                        <div className="w-20 flex-shrink-0 flex flex-col items-center">
                            <img src={editingPersona.avatar} className="w-16 h-16 rounded-md bg-gray-200 mb-2 object-cover" onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${editingPersona.name}&background=random`} />
                            <div className="text-[10px] text-gray-400 text-center break-all w-full">{editingPersona.id}</div>
                        </div>
                        <div className="flex-1 space-y-3">
                             <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">名称</label>
                                <input 
                                    type="text" 
                                    value={editingPersona.name}
                                    onChange={(e) => updatePersonaField(editingPersona.id, 'name', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                                />
                             </div>
                             <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">头像 URL</label>
                                <input 
                                    type="text" 
                                    value={editingPersona.avatar}
                                    onChange={(e) => updatePersonaField(editingPersona.id, 'avatar', e.target.value)}
                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 font-mono"
                                />
                             </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">职业/身份 (Role)</label>
                        <input 
                            type="text" 
                            value={editingPersona.role}
                            onChange={(e) => updatePersonaField(editingPersona.id, 'role', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">代表色 (Tailwind Class)</label>
                        <input 
                            type="text" 
                            value={editingPersona.color}
                            onChange={(e) => updatePersonaField(editingPersona.id, 'color', e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
                            placeholder="text-blue-600"
                        />
                        <div className={`mt-1 text-xs ${editingPersona.color}`}>预览: This is colored text</div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">System Instruction (人设提示词)</label>
                        <textarea 
                            value={editingPersona.systemInstruction}
                            onChange={(e) => updatePersonaField(editingPersona.id, 'systemInstruction', e.target.value)}
                            className="w-full h-24 text-sm border border-gray-300 rounded px-2 py-1.5 resize-none"
                        />
                    </div>

                    {/* Persona Specific Model Config */}
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase">模型绑定</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                                <select 
                                    value={editingPersona.config.provider}
                                    onChange={(e) => updatePersonaConfig(editingPersona.id, 'provider', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
                                >
                                    {MODEL_PROVIDERS.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Model ID</label>
                                <select 
                                    value={editingPersona.config.modelId}
                                    onChange={(e) => updatePersonaConfig(editingPersona.id, 'modelId', e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
                                >
                                    {availableModels.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // List Mode
    return (
        <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-medium text-gray-900">角色管理</h3>
                 <button onClick={handleAddPersona} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors">
                    + 新建角色
                 </button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                 {localPersonas.map(p => (
                     <div key={p.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/50 transition-colors group">
                         <div className="flex items-center gap-3">
                             <img src={p.avatar} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                             <div>
                                 <div className="text-sm font-medium text-gray-800">{p.name}</div>
                                 <div className="text-xs text-gray-500">{p.role}</div>
                             </div>
                         </div>
                         <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => setEditingPersonaId(p.id)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                             </button>
                             <button onClick={() => handleDeletePersona(p.id)} className="p-1.5 text-red-600 hover:bg-red-100 rounded">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
        </div>
    );
  };

  const renderCloudTab = () => (
      <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <h3 className="text-lg font-medium text-gray-900 mb-2">云端同步 (Cloud Sync)</h3>
          <p className="text-xs text-gray-500 mb-6">
              将您的设置、API Key、角色配置同步到云端，以便在其他设备上无缝切换。
              <br/>注意：聊天记录暂不支持同步。
          </p>
          
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 flex-1 flex flex-col">
              {settings.syncCode ? (
                  <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2 text-green-700 font-medium mb-4">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          已连接云端
                      </div>
                      
                      <div className="mb-4">
                          <label className="block text-xs text-blue-600 mb-1 font-bold">您的同步码 (Identity Key)</label>
                          <div className="flex gap-2">
                              <code className="flex-1 bg-white border border-blue-200 p-2 rounded text-xs font-mono break-all select-all text-gray-600">
                                  {settings.syncCode}
                              </code>
                              <button 
                                onClick={() => navigator.clipboard.writeText(settings.syncCode || '')}
                                className="bg-white border border-blue-200 text-blue-600 px-3 rounded hover:bg-blue-100 text-xs"
                              >
                                  复制
                              </button>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2">
                              在其他浏览器登录时，将此代码粘贴到密码框即可自动恢复数据。
                          </p>
                      </div>

                      <div className="mt-auto space-y-3">
                          <button 
                            onClick={handleForcePull}
                            className="w-full bg-white border border-blue-200 text-blue-700 py-2 rounded text-sm hover:bg-blue-50 flex items-center justify-center gap-2"
                          >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                             手动拉取最新数据
                          </button>
                          
                          <button 
                            onClick={handleDisconnectSync}
                            className="w-full bg-red-50 border border-red-100 text-red-600 py-2 rounded text-sm hover:bg-red-100"
                          >
                              断开同步
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="flex flex-col h-full justify-center">
                      <div className="text-center mb-6">
                          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                          </div>
                          <h4 className="font-medium text-gray-900">未配置同步</h4>
                          <p className="text-xs text-gray-500 mt-1">创建一个新的云端存档，或连接已有存档。</p>
                      </div>

                      <div className="space-y-4">
                          <button 
                            onClick={handleStartSync}
                            disabled={syncStatus === 'loading'}
                            className="w-full bg-blue-600 text-white py-2.5 rounded hover:bg-blue-700 text-sm font-medium shadow-sm"
                          >
                              {syncStatus === 'loading' && syncMessage.includes('创建') ? '创建中...' : '开启新同步 (生成 Sync Code)'}
                          </button>
                          
                          <div className="relative flex py-2 items-center">
                              <div className="flex-grow border-t border-blue-200"></div>
                              <span className="flex-shrink-0 mx-4 text-xs text-blue-400">或者</span>
                              <div className="flex-grow border-t border-blue-200"></div>
                          </div>

                          <div>
                              <input 
                                type="text" 
                                placeholder="粘贴已有的 Sync Code"
                                value={inputSyncCode}
                                onChange={(e) => setInputSyncCode(e.target.value)}
                                className="w-full border border-blue-200 rounded px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none mb-2"
                              />
                              <button 
                                onClick={handleConnectSync}
                                disabled={!inputSyncCode.trim() || syncStatus === 'loading'}
                                className="w-full bg-white border border-blue-200 text-blue-700 py-2 rounded hover:bg-blue-50 text-sm font-medium"
                              >
                                  {syncStatus === 'loading' && syncMessage.includes('获取') ? '连接中...' : '连接已有数据'}
                              </button>
                          </div>
                      </div>
                  </div>
              )}
              
              {syncMessage && (
                  <div className={`mt-4 text-xs text-center p-2 rounded ${syncStatus === 'error' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                      {syncMessage}
                  </div>
              )}
          </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-[800px] h-[600px] flex overflow-hidden animate-in fade-in zoom-in duration-200" 
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar */}
        <div className="w-[200px] bg-gray-50 border-r border-gray-200 flex flex-col p-4">
            <h2 className="text-sm font-bold text-gray-800 mb-6 px-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                后台设置
            </h2>
            
            <nav className="space-y-1 flex-1">
                <button 
                    onClick={() => setActiveTab('profile')}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white shadow-sm text-green-700' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                    个人资料
                </button>
                <button 
                    onClick={() => setActiveTab('models')}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'models' ? 'bg-white shadow-sm text-green-700' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                    模型接入
                </button>
                <button 
                    onClick={() => setActiveTab('characters')}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'characters' ? 'bg-white shadow-sm text-green-700' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                    角色管理
                </button>
                <button 
                    onClick={() => setActiveTab('cloud')}
                    className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'cloud' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:bg-gray-200'}`}
                >
                    云端同步
                </button>
            </nav>

            <div className="mt-auto border-t border-gray-200 pt-4">
                 {isAuthenticated ? (
                     <button 
                        onClick={onLogout}
                        className="w-full flex items-center gap-2 text-gray-500 hover:text-red-600 px-2 py-2 text-xs transition-colors"
                     >
                        <span>退出登录</span>
                     </button>
                 ) : (
                     <div className="text-xs text-gray-400 px-2">未登录</div>
                 )}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            {isAuthenticated ? (
                <>
                   <div className="flex-1 p-8 overflow-y-auto custom-scrollbar bg-white relative">
                       {activeTab === 'profile' && renderProfileTab()}
                       {activeTab === 'models' && renderModelsTab()}
                       {activeTab === 'characters' && renderCharactersTab()}
                       {activeTab === 'cloud' && renderCloudTab()}
                   </div>
                   <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">关闭</button>
                        <button onClick={handleSave} className="px-6 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] shadow-sm">保存更改</button>
                   </div>
                </>
            ) : (
                <div className="flex-1 p-8 bg-white h-full">
                    {renderLogin()}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;

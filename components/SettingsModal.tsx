

import React, { useState, useEffect } from 'react';
import { AppSettings, GeminiModelId, ProviderId, ProviderConfig, Persona, ModelOption } from '../types';
import { GEMINI_MODELS, MODEL_PROVIDERS } from '../constants';

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
}

type Tab = 'profile' | 'models' | 'characters';

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
  onUpdateAdminCredentials
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
  const [exportedCode, setExportedCode] = useState<string | null>(null);

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
    }
  }, [isOpen, settings, personas, adminCredentials]);

  if (!isOpen) return null;

  const handleLogin = () => {
    if (username === adminCredentials.username && password === adminCredentials.password) {
      onLoginSuccess();
      setError('');
    } else {
      setError('用户名或密码错误');
    }
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

  const handleExportDefaults = () => {
      // Construct current settings object to export
      const currentConfig: AppSettings = {
          userAvatar: localAvatar,
          userName: settings.userName,
          geminiModel: localGeminiModel,
          enableThinking: localEnableThinking,
          activeProvider: localActiveProvider,
          providerConfigs: localProviderConfigs
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


  const renderLogin = () => (
    <div className="flex flex-col h-full justify-center">
      <div className="bg-yellow-50 text-yellow-800 p-3 rounded text-sm mb-6 flex items-center">
         <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
         访问此区域需要管理员权限
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">账号</label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            placeholder="请输入账号"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 transition-shadow"
            placeholder="请输入密码"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button 
          onClick={handleLogin}
          className="w-full bg-[#07c160] text-white py-2.5 rounded hover:bg-[#06ad56] transition-colors font-medium mt-2"
        >
          登录后台
        </button>
      </div>
    </div>
  );

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
            
            {/* Export Config Section */}
            <div className="pt-4 border-t border-gray-100 mt-6">
               <h4 className="text-sm font-medium text-gray-900 mb-2">部署配置</h4>
               <p className="text-xs text-gray-500 mb-3">导出当前设置作为应用的默认配置 (DEFAULT_APP_SETTINGS)。</p>
               <button 
                  onClick={handleExportDefaults}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
               >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                   生成默认配置代码
               </button>
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
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <h3 className="text-lg font-medium text-gray-900">编辑角色: {editingPersona.name}</h3>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                     {/* Basic Info */}
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

                     {/* System Prompt */}
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

                     {/* Model Config */}
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
                    <h3 className="text-lg font-medium text-gray-900">角色管理</h3>
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
                {!isAuthenticated ? renderLogin() : (
                    <>
                        {activeTab === 'profile' && renderProfileTab()}
                        {activeTab === 'models' && renderModelsTab()}
                        {activeTab === 'characters' && renderCharactersTab()}
                    </>
                )}
            </div>

            {/* Footer Actions (Only if authenticated) */}
            {isAuthenticated && (
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
                    <button 
                      onClick={onClose}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleSave}
                      className="px-4 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] shadow-sm font-medium transition-colors"
                    >
                      保存设置
                    </button>
                </div>
            )}
            
            {/* Export Code Modal Overlay */}
            {exportedCode && (
                <div className="absolute inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-full">
                         <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                             <h3 className="font-bold text-gray-800">默认配置代码</h3>
                             <button onClick={() => setExportedCode(null)} className="text-gray-500 hover:text-gray-700">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                             </button>
                         </div>
                         <div className="p-4 flex-1 overflow-hidden relative">
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

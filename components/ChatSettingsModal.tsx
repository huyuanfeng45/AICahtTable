import React, { useState, useEffect } from 'react';
import { ChatGroup, Persona, ChatGroupConfig, Message, AppSettings, ChatMemberConfig } from '../types';
import { generateChatName, generateImagePrompt } from '../services/geminiService';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatGroup;
  allPersonas: Persona[];
  onUpdateChat: (updatedChat: ChatGroup) => void;
  onDeleteChat?: () => void;
  messages: Message[];
  settings: AppSettings;
  onClearHistory?: () => void;
}

const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  onClose,
  chat,
  allPersonas,
  onUpdateChat,
  onDeleteChat,
  messages,
  settings,
  onClearHistory
}) => {
  const [name, setName] = useState(chat.name);
  const [avatar, setAvatar] = useState(chat.avatar);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(chat.members);
  const [memberConfigs, setMemberConfigs] = useState<Record<string, ChatMemberConfig>>(chat.config?.memberConfigs || {});
  const [summaryAgentId, setSummaryAgentId] = useState<string>(chat.config?.summaryAgentId || '');
  
  // Speaking Order State
  const [speakingOrder, setSpeakingOrder] = useState<string[]>([]);
  const [enableRandomOrder, setEnableRandomOrder] = useState(false);
  const [enableAutoDiscussion, setEnableAutoDiscussion] = useState(false);

  const [isGeneratingName, setIsGeneratingName] = useState(false);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(chat.name);
      setAvatar(chat.avatar);
      setSelectedMembers(chat.members);
      setMemberConfigs(chat.config?.memberConfigs || {});
      setSummaryAgentId(chat.config?.summaryAgentId || '');
      setEnableRandomOrder(chat.config?.enableRandomOrder || false);
      setEnableAutoDiscussion(chat.config?.enableAutoDiscussion || false);
      
      const currentMemberSet = new Set(chat.members);
      const existingOrder = chat.config?.speakingOrder || [];
      const validExistingOrder = existingOrder.filter(id => currentMemberSet.has(id));
      const missingMembers = chat.members.filter(id => !validExistingOrder.includes(id));
      setSpeakingOrder([...validExistingOrder, ...missingMembers]);
    }
  }, [isOpen, chat]);

  if (!isOpen) return null;

  const handleSave = () => {
    const updatedChat: ChatGroup = {
      ...chat,
      name,
      avatar,
      members: selectedMembers,
      config: {
        memberConfigs: memberConfigs,
        summaryAgentId: summaryAgentId || undefined,
        speakingOrder: speakingOrder,
        enableRandomOrder: enableRandomOrder,
        enableAutoDiscussion: enableAutoDiscussion
      }
    };
    onUpdateChat(updatedChat);
    onClose();
  };

  const handleAutoGenerateName = async () => {
    if (messages.length < 2) {
        alert("聊天记录太少，无法生成有意义的名称");
        return;
    }
    
    setIsGeneratingName(true);
    try {
        const generatedName = await generateChatName(messages, allPersonas, settings);
        if (generatedName) {
            const cleanName = generatedName.replace(/^["'《]+|["'》]+$/g, '').trim();
            setName(cleanName);
        }
    } catch (e) {
        console.error("Auto name generation failed", e);
        alert("生成失败，请检查网络配置");
    } finally {
        setIsGeneratingName(false);
    }
  };

  const handleAutoGenerateAvatar = async () => {
      if (!name) return;
      setIsGeneratingAvatar(true);
      try {
          const prompt = await generateImagePrompt(name, settings);
          const encodedPrompt = encodeURIComponent(prompt);
          const newAvatarUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=200&height=200&nologo=true`;
          setAvatar(newAvatarUrl);
      } catch (e) {
          console.error("Avatar gen failed", e);
      } finally {
          setIsGeneratingAvatar(false);
      }
  };

  const toggleMember = (personaId: string) => {
    if (selectedMembers.includes(personaId)) {
      setSelectedMembers(prev => prev.filter(id => id !== personaId));
      setSpeakingOrder(prev => prev.filter(id => id !== personaId));
    } else {
      setSelectedMembers(prev => [...prev, personaId]);
      if (!memberConfigs[personaId]) {
        setMemberConfigs(prev => ({ ...prev, [personaId]: { roleId: personaId, replyCount: 1 } }));
      }
      setSpeakingOrder(prev => [...prev, personaId]);
    }
  };

  const updateReplyCount = (personaId: string, count: number) => {
    setMemberConfigs(prev => ({
      ...prev,
      [personaId]: { ...prev[personaId], replyCount: Math.max(1, count) }
    }));
  };

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === speakingOrder.length - 1) return;

    const newOrder = [...speakingOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setSpeakingOrder(newOrder);
  };
  
  const handleClearHistoryAction = () => {
      if (window.confirm("确定要清空当前的所有聊天记录吗？此操作无法撤销。")) {
          onClearHistory?.();
          onClose();
      }
  };

  const handleDeleteChatAction = () => {
      onDeleteChat?.(); 
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[90vw] md:w-[500px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-4 md:px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">群聊设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          
          {/* Identity Section (Compact) */}
          <div className="flex gap-3 md:gap-4 items-center">
                <div className="flex-shrink-0 relative group">
                    <img 
                        src={avatar} 
                        alt="Preview" 
                        className="w-16 h-16 rounded-lg object-cover bg-gray-100 border border-gray-200 shadow-sm"
                        onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${name || 'Group'}&background=random`}
                    />
                </div>
                
                <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-center gap-2">
                         <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">名称</label>
                         <div className="flex-1 flex gap-2 min-w-0">
                             <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-green-500 focus:border-green-500"
                                placeholder="群聊名称"
                            />
                            <button 
                                onClick={handleAutoGenerateName}
                                disabled={isGeneratingName}
                                className="px-2 py-1 bg-gray-50 text-gray-600 border border-gray-200 rounded text-xs whitespace-nowrap hover:bg-gray-100 flex items-center gap-1 flex-shrink-0"
                                title="自动生成"
                            >
                                {isGeneratingName ? (
                                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <span className="text-[10px] font-bold">⚡ 自动</span>
                                )}
                            </button>
                         </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <label className="text-sm font-medium text-gray-700 w-12 flex-shrink-0">头像</label>
                         <div className="flex-1 flex gap-2 min-w-0">
                             <input
                                type="text"
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-xs text-gray-600 focus:ring-green-500 focus:border-green-500 font-mono"
                                placeholder="https://..."
                            />
                             <button 
                                onClick={handleAutoGenerateAvatar}
                                disabled={isGeneratingAvatar || !name}
                                className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs whitespace-nowrap hover:bg-purple-100 flex items-center gap-1 flex-shrink-0"
                                title="AI 生成"
                            >
                                {isGeneratingAvatar ? (
                                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <span className="text-[10px] font-bold">🎨 AI</span>
                                )}
                            </button>
                         </div>
                    </div>
                </div>
          </div>
          
          {/* Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">成员管理 & 发言次数</label>
            <p className="text-xs text-gray-500 mb-3">勾选加入群聊的角色，并设置每轮对话该角色发言的次数。</p>
            
            <div className="space-y-2 border border-gray-100 rounded-lg p-2 max-h-[250px] overflow-y-auto custom-scrollbar">
              {allPersonas.map(persona => {
                const isSelected = selectedMembers.includes(persona.id);
                const replyCount = memberConfigs[persona.id]?.replyCount || 1;

                return (
                  <div key={persona.id} className={`flex items-center justify-between p-2 rounded ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                    <div className="flex items-center flex-1 cursor-pointer" onClick={() => toggleMember(persona.id)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} 
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <img src={persona.avatar} className="w-8 h-8 rounded-full ml-3 mr-2 bg-gray-200 object-cover" />
                      <div className="flex flex-col">
                         <span className={`text-sm ${isSelected ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{persona.name}</span>
                         <span className="text-[10px] text-gray-400">{persona.role}</span>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">次数:</span>
                        <input 
                           type="number"
                           min="1"
                           max="5"
                           value={replyCount}
                           onChange={(e) => updateReplyCount(persona.id, parseInt(e.target.value))}
                           onClick={(e) => e.stopPropagation()}
                           className="w-12 text-xs border border-gray-300 rounded px-1 py-0.5 text-center focus:outline-none focus:border-green-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Speaking Order Config */}
          <div>
             <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">发言顺序</label>
             </div>

             <div className="flex flex-col gap-2 mb-3">
                 <div className="flex items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer" onClick={() => {setEnableAutoDiscussion(true); setEnableRandomOrder(false)}}>
                    <input 
                      type="radio"
                      name="orderType"
                      checked={enableAutoDiscussion}
                      onChange={() => {setEnableAutoDiscussion(true); setEnableRandomOrder(false)}}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="ml-2">
                        <span className="text-sm font-medium text-gray-700 block">AI 互相讨论 (AI Mutual Discussion)</span>
                        <span className="text-xs text-gray-500">角色之间可互相回复，随机发言，每人发言约 2 次 (不连续)。</span>
                    </div>
                 </div>

                 <div className="flex items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer" onClick={() => {setEnableAutoDiscussion(false); setEnableRandomOrder(true)}}>
                    <input 
                      type="radio"
                      name="orderType"
                      checked={!enableAutoDiscussion && enableRandomOrder}
                      onChange={() => {setEnableAutoDiscussion(false); setEnableRandomOrder(true)}}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
                    />
                    <div className="ml-2">
                        <span className="text-sm font-medium text-gray-700 block">随机顺序 (Random Order)</span>
                        <span className="text-xs text-gray-500">按照"发言次数"设置，随机打乱所有发言顺序。</span>
                    </div>
                 </div>

                 <div className="flex items-center p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200 cursor-pointer" onClick={() => {setEnableAutoDiscussion(false); setEnableRandomOrder(false)}}>
                    <input 
                      type="radio"
                      name="orderType"
                      checked={!enableAutoDiscussion && !enableRandomOrder}
                      onChange={() => {setEnableAutoDiscussion(false); setEnableRandomOrder(false)}}
                      className="h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300"
                    />
                    <div className="ml-2">
                        <span className="text-sm font-medium text-gray-700 block">固定顺序 (Fixed Order)</span>
                        <span className="text-xs text-gray-500">按照下方列表的顺序依次发言。</span>
                    </div>
                 </div>
             </div>
             
             {!enableRandomOrder && !enableAutoDiscussion && selectedMembers.length > 0 && (
                 <div className="border border-gray-100 rounded-lg p-2 space-y-1 bg-gray-50/50">
                    {speakingOrder.map((id, index) => {
                       const persona = allPersonas.find(p => p.id === id);
                       if (!persona) return null;
                       return (
                           <div key={id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100 shadow-sm">
                               <div className="flex items-center">
                                   <span className="text-xs text-gray-400 w-5 text-center">{index + 1}</span>
                                   <img src={persona.avatar} className="w-6 h-6 rounded-full mx-2" />
                                   <span className="text-sm text-gray-700">{persona.name}</span>
                               </div>
                               <div className="flex items-center gap-1">
                                   <button 
                                     onClick={() => moveOrder(index, 'up')}
                                     disabled={index === 0}
                                     className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30"
                                   >
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path></svg>
                                   </button>
                                   <button 
                                     onClick={() => moveOrder(index, 'down')}
                                     disabled={index === speakingOrder.length - 1}
                                     className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30"
                                   >
                                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                   </button>
                               </div>
                           </div>
                       );
                    })}
                 </div>
             )}
          </div>

          {/* Summary Agent */}
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">会议总结员</label>
             <p className="text-xs text-gray-500 mb-2">指定一个角色负责对聊天内容进行总结。</p>
             <select 
               value={summaryAgentId}
               onChange={(e) => setSummaryAgentId(e.target.value)}
               className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-green-500 focus:border-green-500"
             >
                <option value="">(无)</option>
                {selectedMembers.map(id => {
                  const p = allPersonas.find(ap => ap.id === id);
                  if (!p) return null;
                  return <option key={p.id} value={p.id}>{p.name}</option>;
                })}
             </select>
          </div>
          
          {/* Danger Zone */}
          <div className="pt-6 mt-4 border-t border-gray-100">
             <h4 className="text-xs font-semibold text-red-600 mb-2 uppercase tracking-wider">危险区域</h4>
             <div className="space-y-3">
                 <button 
                    onClick={handleClearHistoryAction}
                    className="w-full flex items-center justify-center gap-2 text-sm bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 hover:border-orange-300 px-4 py-2.5 rounded-lg transition-all shadow-sm"
                 >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                     清空当前聊天记录
                 </button>
                 
                 {onDeleteChat && (
                     <button 
                        onClick={handleDeleteChatAction}
                        className="w-full flex items-center justify-center gap-2 text-sm bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 px-4 py-2.5 rounded-lg transition-all shadow-sm"
                     >
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                         删除整个群聊
                     </button>
                 )}
             </div>
             <p className="text-[10px] text-gray-400 mt-2 text-center">操作不可恢复，请谨慎操作。</p>
          </div>
          
          {/* Scroll Hint (Bottom Padding) */}
          <div className="h-4"></div>
        </div>

        <div className="px-4 md:px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 z-10">
           <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
           <button onClick={handleSave} className="px-4 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56]">保存设置</button>
        </div>
      </div>
    </div>
  );
};

export default ChatSettingsModal;
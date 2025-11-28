import React, { useState, useEffect } from 'react';
import { ChatGroup, Persona, ChatGroupConfig, Message, AppSettings } from '../types';
import { generateChatName, generateImagePrompt } from '../services/geminiService';

interface ChatSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: ChatGroup;
  allPersonas: Persona[];
  onUpdateChat: (updatedChat: ChatGroup) => void;
  messages: Message[];
  settings: AppSettings;
}

const ChatSettingsModal: React.FC<ChatSettingsModalProps> = ({
  isOpen,
  onClose,
  chat,
  allPersonas,
  onUpdateChat,
  messages,
  settings
}) => {
  const [name, setName] = useState(chat.name);
  const [avatar, setAvatar] = useState(chat.avatar);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(chat.members);
  const [memberConfigs, setMemberConfigs] = useState<Record<string, { replyCount: number }>>(chat.config?.memberConfigs || {});
  const [summaryAgentId, setSummaryAgentId] = useState<string>(chat.config?.summaryAgentId || '');
  
  // Speaking Order State
  const [speakingOrder, setSpeakingOrder] = useState<string[]>([]);
  const [enableRandomOrder, setEnableRandomOrder] = useState(false);

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
      
      // Initialize speaking order with integrity check
      const currentMemberSet = new Set(chat.members);
      const existingOrder = chat.config?.speakingOrder || [];
      
      // Filter existing order to only keep current members
      const validExistingOrder = existingOrder.filter(id => currentMemberSet.has(id));
      
      // Find members missing from the order and append them
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
        enableRandomOrder: enableRandomOrder
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
            // Clean up name (remove quotes if any)
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
          // 1. Get a prompt from LLM
          const prompt = await generateImagePrompt(name, settings);
          // 2. Construct a Pollinations.ai URL
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
      // Remove member
      setSelectedMembers(prev => prev.filter(id => id !== personaId));
      setSpeakingOrder(prev => prev.filter(id => id !== personaId));
    } else {
      // Add member
      setSelectedMembers(prev => [...prev, personaId]);
      // Initialize config if not exists
      if (!memberConfigs[personaId]) {
        setMemberConfigs(prev => ({ ...prev, [personaId]: { replyCount: 1 } }));
      }
      // Add to speaking order (at end)
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">群聊设置</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">群聊名称</label>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 border border-gray-300 rounded px-3 py-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    placeholder="输入群聊名称"
                />
                <button 
                    onClick={handleAutoGenerateName}
                    disabled={isGeneratingName}
                    className="bg-[#f2f2f2] hover:bg-[#e6e6e6] text-gray-700 px-3 py-2 rounded text-xs whitespace-nowrap border border-gray-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="根据聊天内容自动生成 (3-10字)"
                >
                    {isGeneratingName ? (
                        <svg className="animate-spin h-3 w-3 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    )}
                    自动生成
                </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">AI 将根据最近的聊天记录生成 3-10 字的标题。</p>
          </div>

          {/* Group Avatar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">群聊头像</label>
            <div className="flex items-start gap-4">
                <div className="relative group flex-shrink-0">
                    <img 
                      src={avatar} 
                      alt="Preview" 
                      className="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-200"
                      onError={(e) => e.currentTarget.src = `https://ui-avatars.com/api/?name=${name}&background=random`}
                    />
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={avatar}
                            onChange={(e) => setAvatar(e.target.value)}
                            className="flex-1 border border-gray-300 rounded px-3 py-2 focus:ring-green-500 focus:border-green-500 text-xs font-mono text-gray-600"
                            placeholder="https://..."
                        />
                        <button 
                            onClick={handleAutoGenerateAvatar}
                            disabled={isGeneratingAvatar || !name}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 px-3 py-2 rounded text-xs whitespace-nowrap flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                             {isGeneratingAvatar ? (
                                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            )}
                            AI 生成
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400">支持图片 URL 或使用 AI 根据群名生成。</p>
                </div>
            </div>
          </div>

          {/* Members & Reply Counts */}
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
                        onChange={() => {}} // handled by div click
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
                <div className="flex items-center">
                    <input 
                      id="randomOrder"
                      type="checkbox"
                      checked={enableRandomOrder}
                      onChange={(e) => setEnableRandomOrder(e.target.checked)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="randomOrder" className="ml-2 text-xs text-gray-600 select-none cursor-pointer">随机顺序 (Random)</label>
                </div>
             </div>
             
             {!enableRandomOrder && selectedMembers.length > 0 && (
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
             {enableRandomOrder && (
                 <div className="p-3 bg-gray-50 rounded text-xs text-gray-500 text-center border border-dashed border-gray-200">
                     启用随机顺序后，每轮对话 AI 的发言次序将随机打乱。
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

        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
           <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">取消</button>
           <button onClick={handleSave} className="px-4 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56]">保存设置</button>
        </div>
      </div>
    </div>
  );
};

export default ChatSettingsModal;

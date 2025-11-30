

import React, { useState, useRef, useEffect } from 'react';
import { ChatGroup, Message, Persona, AppSettings, Favorite } from '../types';
import { USER_ID } from '../constants';
import MessageBubble from './MessageBubble';
import ChatSettingsModal from './ChatSettingsModal';
import EmojiPicker from './EmojiPicker';
import { generatePersonaResponse } from '../services/geminiService';

interface ChatWindowProps {
  chat: ChatGroup;
  settings: AppSettings;
  allPersonas: Persona[];
  onUpdateChat: (updatedChat: ChatGroup) => void;
  onDeleteChat?: (chatId: string) => void;
  onAddToFavorites?: (messages: Message[], sourceName: string) => void;
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chat, settings, allPersonas, onUpdateChat, onDeleteChat, onAddToFavorites, onBack }) => {
  const STORAGE_KEY = `chat_msgs_${chat.id}`;

  // Initialize state from LocalStorage or Defaults
  // Note: Since App.tsx uses key={chat.id}, this component remounts on chat switch,
  // so this initializer runs every time the user switches chats.
  const [messages, setMessages] = useState<Message[]>(() => {
    // 1. If readonly (Favorites), use the messages passed in the prop (injected via type assertion in App.tsx)
    if ((chat as any).messages) {
      return (chat as any).messages;
    }

    // 2. Try loading from Local Storage
    if (!chat.isReadOnly) {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Failed to load chat history", e);
        }
    }

    // 3. Default fallback for the main demo group if storage is empty
    if (chat.id === 'group_main') {
      return [{
        id: '1',
        senderId: 'moderator',
        content: '欢迎来到 AI 圆桌会议。我是群主。请提出任何问题，我们的专家团队会为您分析。',
        timestamp: Date.now(),
        isUser: false
      }];
    }
    
    // 4. Empty for new chats
    return [];
  });

  const messagesRef = useRef<Message[]>(messages);
  
  // Sync ref and LocalStorage
  useEffect(() => {
    messagesRef.current = messages;
    
    // Save to local storage whenever messages change
    if (!chat.isReadOnly) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, chat.isReadOnly, STORAGE_KEY]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSpeakerName, setProcessingSpeakerName] = useState<string | null>(null); // New: Track who is thinking
  const [isChatSettingsOpen, setIsChatSettingsOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  // Focus input on chat change
  useEffect(() => {
    if (!chat.isReadOnly) {
        textareaRef.current?.focus();
    }
    setShowEmojiPicker(false); // Close emoji picker when switching chats
    setShowExportMenu(false);
    setIsSelectionMode(false);
    setSelectedMsgIds(new Set());
  }, [chat.id, chat.isReadOnly]);


  const addMessage = (msg: Message) => {
    setMessages(prev => [...prev, msg]);
  };

  // Helper to trigger parent update (for lastMessage preview and Sync triggers)
  const updateLastMessage = (text: string) => {
      onUpdateChat({
          ...chat,
          lastMessage: text,
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    setProcessingSpeakerName(null);

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: USER_ID,
      content: userText,
      timestamp: Date.now(),
      isUser: true
    };
    addMessage(userMsg);
    
    // Maintain a local history context for the loop, so AIs can see previous AI messages immediately
    // (React State update is async, so messagesRef.current won't update instantly inside the loop)
    const conversationContext = [...messagesRef.current, userMsg];
    
    // Update Sidebar Preview & Trigger Sync
    updateLastMessage(userText);

    // 2. Determine Order & Build Queue
    let speechQueue: Persona[] = [];
    
    // Determine active members (IDs)
    const memberIds = chat.members.length > 0 
        ? chat.members 
        : (chat.id === 'group_main' ? allPersonas.map(p => p.id) : []);
    
    if (chat.config?.enableAutoDiscussion) {
        // --- Discussion Mode Logic ---
        // 1. Everyone speaks 2 times (default)
        // 2. Order is random and interleaved
        
        memberIds.forEach(id => {
            const persona = allPersonas.find(p => p.id === id);
            if (persona) {
                // Add to queue twice
                speechQueue.push(persona);
                speechQueue.push(persona);
            }
        });

        // Fisher-Yates Shuffle for true randomness
        for (let i = speechQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [speechQueue[i], speechQueue[j]] = [speechQueue[j], speechQueue[i]];
        }
        
    } else if (chat.config?.enableRandomOrder) {
        // --- Random Order Logic (Single Turn per configured ReplyCount) ---
        // Random Mode: Flatten all turns and shuffle them completely
        memberIds.forEach(id => {
            const persona = allPersonas.find(p => p.id === id);
            if (persona) {
                const replyCount = chat.config?.memberConfigs?.[id]?.replyCount || 1;
                for (let i = 0; i < replyCount; i++) {
                    speechQueue.push(persona);
                }
            }
        });

        // Fisher-Yates Shuffle
        for (let i = speechQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [speechQueue[i], speechQueue[j]] = [speechQueue[j], speechQueue[i]];
        }

    } else {
        // --- Standard Ordered Logic ---
        // Respect Speaking Order and Group turns (A, A, B)
        let orderedIds: string[] = [];
        const configOrder = chat.config?.speakingOrder || [];
        
        // Ensure integrity: Start with configOrder, keep only those currently active
        orderedIds = configOrder.filter(id => memberIds.includes(id));
        
        // Append any active members that might be missing from the configured order (e.g. newly added)
        const missing = memberIds.filter(id => !orderedIds.includes(id));
        orderedIds = [...orderedIds, ...missing];

        // Populate queue
        orderedIds.forEach(id => {
            const persona = allPersonas.find(p => p.id === id);
            if (persona) {
                const replyCount = chat.config?.memberConfigs?.[id]?.replyCount || 1;
                for (let i = 0; i < replyCount; i++) {
                    speechQueue.push(persona);
                }
            }
        });
    }

    // If no queue (empty chat), just stop
    if (speechQueue.length === 0) {
        setIsProcessing(false);
        return;
    }

    try {
        for (const persona of speechQueue) {
            setProcessingSpeakerName(persona.name);
            
            // OPTIMIZATION: Reduced artificial delay to 200ms
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const responseText = await generatePersonaResponse(
                persona,
                userText,
                conversationContext, // Use the updated local context
                allPersonas,
                settings 
            );

            const aiMsg: Message = {
                id: Date.now().toString() + persona.id + Math.random(),
                senderId: persona.id,
                content: responseText,
                timestamp: Date.now(),
                isUser: false
            };
            
            addMessage(aiMsg);
            
            // Critical: Push to local context so next AI in loop sees this message
            conversationContext.push(aiMsg);
            
            // Update Sidebar Preview & Trigger Sync on AI response
            updateLastMessage(responseText);
        }
    } catch (e) {
        console.error(e);
        addMessage({
            id: Date.now().toString(),
            senderId: 'system',
            content: '连接异常，会议中断。',
            timestamp: Date.now(),
            isUser: false,
            isSystem: true
        });
    } finally {
        setIsProcessing(false);
        setProcessingSpeakerName(null);
    }
  };
  
  const handleSummarize = async () => {
      const summaryAgentId = chat.config?.summaryAgentId;
      if (!summaryAgentId) return;
      
      const summarizer = allPersonas.find(p => p.id === summaryAgentId);
      if (!summarizer) return;
      
      setIsProcessing(true);
      setProcessingSpeakerName(summarizer.name); // Show who is summarizing

      try {
          const responseText = await generatePersonaResponse(
                summarizer,
                "请对上述所有讨论进行总结，提炼出核心观点和结论。",
                messagesRef.current,
                allPersonas,
                settings 
            );
          
           const aiMsg: Message = {
                id: Date.now().toString() + summarizer.id + '_summary',
                senderId: summarizer.id,
                content: `【会议总结】\n${responseText}`,
                timestamp: Date.now(),
                isUser: false
            };
            addMessage(aiMsg);
            updateLastMessage(`【会议总结】${responseText.substring(0, 20)}...`);
      } finally {
          setIsProcessing(false);
          setProcessingSpeakerName(null);
      }
  };
  
  // Clear History Logic
  const handleClearHistory = () => {
      // 1. Update State immediately
      setMessages([]);
      
      // 2. Clear Local Storage
      if (!chat.isReadOnly) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      }
      
      // 3. Update parent chat metadata (sidebar preview)
      onUpdateChat({
          ...chat,
          lastMessage: ''
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // --- Favorites Logic ---
  
  const toggleSelectMessage = (msgId: string) => {
      const newSet = new Set(selectedMsgIds);
      if (newSet.has(msgId)) {
          newSet.delete(msgId);
      } else {
          newSet.add(msgId);
      }
      setSelectedMsgIds(newSet);
  };
  
  const handleSaveSelected = () => {
      if (selectedMsgIds.size === 0) return;
      
      const msgsToSave = messages.filter(m => selectedMsgIds.has(m.id));
      onAddToFavorites?.(msgsToSave, chat.name);
      
      // Exit selection mode
      setIsSelectionMode(false);
      setSelectedMsgIds(new Set());
  };
  
  const handleSaveAll = () => {
      onAddToFavorites?.(messages, chat.name);
      setShowExportMenu(false);
  };
  
  const handleQuickFavorite = (msg: Message) => {
      onAddToFavorites?.([msg], chat.name);
  };


  // --- Export / Helpers ---
  
  const handleEmojiSelect = (emoji: string) => {
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = inputText;
        const newText = text.substring(0, start) + emoji + text.substring(end);
        setInputText(newText);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + emoji.length;
            }
        }, 0);
    } else {
        setInputText(prev => prev + emoji);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
        alert("文件大小不能超过 100MB");
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    if (file.type.startsWith('image/')) {
        reader.onload = (event) => {
            const result = event.target?.result as string;
            if (result) {
                 setInputText(prev => {
                    const separator = prev.trim() ? '\n\n' : '';
                    return `${prev}${separator}![${file.name}](${result})`;
                });
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                    }
                }, 100);
            }
        };
        reader.readAsDataURL(file);
    } 
    else {
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const ext = file.name.split('.').pop() || 'txt';
                setInputText(prev => {
                    const separator = prev.trim() ? '\n\n' : '';
                    return `${prev}${separator}File: ${file.name}\n\`\`\`${ext}\n${content}\n\`\`\``;
                });
                setTimeout(() => {
                    if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                    }
                }, 100);
            }
        };
        reader.onerror = () => { alert("无法读取文件内容。"); };
        reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleExportText = () => {
    const text = messages.map(msg => {
          const sender = allPersonas.find(p => p.id === msg.senderId);
          const name = msg.isUser ? (settings.userName || 'User') : (sender?.name || 'Unknown AI');
          const time = new Date(msg.timestamp).toLocaleString();
          return `[${time}] ${name}:\n${msg.content}\n`;
      }).join('\n-------------------\n');

      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chat.name}_chat_history.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowExportMenu(false);
  };

  const handleExportImage = async () => {
    setIsExporting(true);
      setShowExportMenu(false);

      if (!chatContainerRef.current) return;

      try {
          const original = chatContainerRef.current;
          const clone = original.cloneNode(true) as HTMLElement;
          clone.style.position = 'fixed';
          clone.style.top = '0';
          clone.style.left = '0';
          clone.style.width = `${original.offsetWidth}px`; 
          clone.style.height = 'auto'; 
          clone.style.maxHeight = 'none'; 
          clone.style.overflow = 'visible';
          clone.style.zIndex = '-9999';
          clone.style.background = '#f5f5f5'; 

          document.body.appendChild(clone);
          const html2canvas = (window as any).html2canvas;
          
          if (!html2canvas) {
             alert("Snapshot library is loading, please try again in a moment.");
             document.body.removeChild(clone);
             setIsExporting(false);
             return;
          }

          const canvas = await html2canvas(clone, {
              useCORS: true,
              scale: 2, 
              windowWidth: original.offsetWidth,
          });

          document.body.removeChild(clone);

          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `${chat.name}_snapshot.png`;
          link.href = dataUrl;
          link.click();
      } catch (err) {
          console.error("Export image failed", err);
          alert("导出图片失败");
      } finally {
          setIsExporting(false);
      }
  };

  const summaryAgent = allPersonas.find(p => p.id === chat.config?.summaryAgentId);
  const isPrivate = chat.type === 'private';
  const isReadOnly = chat.isReadOnly;

  return (
    <div className="flex-1 h-full flex flex-col bg-[#f5f5f5] relative">
      {/* Loading Overlay */}
      {isExporting && (
          <div className="absolute inset-0 bg-black bg-opacity-20 z-[60] flex items-center justify-center">
              <div className="bg-white px-4 py-2 rounded shadow-lg flex items-center justify-center gap-2 text-sm">
                   <svg className="animate-spin h-4 w-4 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <span>正在生成图片...</span>
              </div>
          </div>
      )}

      {/* Header */}
      <div className={`h-[60px] border-b border-[#e7e7e7] bg-[#f5f5f5] flex items-center justify-between px-4 md:px-6 flex-shrink-0 select-none ${isReadOnly ? 'bg-orange-50' : ''}`}>
        <div className="flex items-center gap-2">
           {/* Mobile Back Button */}
           {onBack && (
               <button 
                  onClick={onBack}
                  className="md:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-200 transition-colors"
               >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
               </button>
           )}
           <h2 className="text-[16px] font-medium text-gray-900 flex items-center truncate max-w-[180px] md:max-w-none">
             {chat.name}
             {!isPrivate && !isReadOnly && (
                <span className="ml-2 bg-gray-200 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-full font-normal flex-shrink-0">
                    {chat.members.length > 0 ? chat.members.length : allPersonas.length}人
                </span>
             )}
             {isReadOnly && (
                 <span className="ml-2 bg-orange-200 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-normal flex-shrink-0">
                     收藏存档
                 </span>
             )}
           </h2>
        </div>
        <div className="flex items-center gap-3">
           {!isPrivate && !isReadOnly && (
                <div className="hidden md:flex items-center gap-1 bg-gray-100 px-2 py-1 rounded border border-gray-200 cursor-default">
                    <div className="flex -space-x-1">
                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400"></div>
                        <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                    </div>
                    <span className="text-[10px] text-gray-500 ml-1">多模型混合协作中</span>
                </div>
           )}
           
           {!isReadOnly && (
               <div 
                    className="text-gray-500 hover:text-black cursor-pointer p-1 rounded hover:bg-gray-200 transition-colors"
                    onClick={() => setIsChatSettingsOpen(true)}
                    title="群聊设置"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                    </svg>
                </div>
           )}
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-[#f5f5f5]"
      >
        {messages.map((msg) => {
          const persona = allPersonas.find(p => p.id === msg.senderId);
          return (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              persona={persona} 
              userAvatar={settings.userAvatar}
              selectionMode={isSelectionMode}
              isSelected={selectedMsgIds.has(msg.id)}
              onToggleSelect={toggleSelectMessage}
              onFavorite={!isReadOnly ? handleQuickFavorite : undefined}
            />
          );
        })}
        
        {isProcessing && (
          <div className="flex items-center text-xs text-gray-400 ml-4 mb-2 animate-pulse gap-2">
             <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
             <span>{processingSpeakerName ? `${processingSpeakerName} 正在输入...` : '正在输入...'}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area / Actions Area */}
      {isReadOnly ? (
          <div className="h-[60px] bg-gray-100 border-t border-[#e7e7e7] flex items-center justify-center text-gray-500 text-sm">
             此为收藏内容，仅供查阅
          </div>
      ) : isSelectionMode ? (
          /* Selection Mode Footer */
          <div className="h-[60px] bg-white border-t border-[#e7e7e7] flex items-center justify-between px-4 md:px-6 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10">
              <span className="text-sm text-gray-600">
                  已选择 {selectedMsgIds.size} 条
              </span>
              <div className="flex gap-3">
                  <button 
                      onClick={() => {
                          setIsSelectionMode(false);
                          setSelectedMsgIds(new Set());
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                  >
                      取消
                  </button>
                  <button 
                      onClick={handleSaveSelected}
                      disabled={selectedMsgIds.size === 0}
                      className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                      <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                      收藏
                  </button>
              </div>
          </div>
      ) : (
          /* Normal Input Area */
          <div className="h-[140px] md:h-[180px] bg-[#f5f5f5] border-t border-[#e7e7e7] flex flex-col flex-shrink-0">
            {/* Toolbar */}
            <div className="h-[40px] px-2 md:px-4 flex items-center justify-between text-gray-600">
            <div className="flex items-center gap-3 md:gap-4">
                {/* Emoji */}
                <div className="relative">
                    <div 
                            className={`cursor-pointer hover:text-gray-900 transition-colors p-1 ${showEmojiPicker ? 'text-gray-900' : ''}`}
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            title="插入表情"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                            <line x1="9" y1="9" x2="9.01" y2="9"></line>
                            <line x1="15" y1="9" x2="15.01" y2="9"></line>
                        </svg>
                    </div>
                    {showEmojiPicker && (
                        <EmojiPicker 
                            onSelect={handleEmojiSelect}
                            onClose={() => setShowEmojiPicker(false)}
                        />
                    )}
                </div>

                {/* File Upload */}
                <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".txt,.md,.json,.js,.ts,.css,.html,.py,.java,.c,.cpp,.h,.csv,.log,.xml,.yaml,.yml,image/*"
                />
                <div 
                    className="cursor-pointer hover:text-gray-900 p-1" 
                    title="上传文件"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                        <polyline points="13 2 13 9 20 9"></polyline>
                    </svg>
                </div>
                
                {/* Export / Download / Favorites */}
                <div className="relative">
                    <div 
                            className={`cursor-pointer hover:text-gray-900 transition-colors p-1 ${showExportMenu ? 'text-gray-900' : ''}`}
                            title="更多操作"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                    
                    {showExportMenu && (
                        <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowExportMenu(false)}></div>
                            <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 shadow-xl rounded-lg p-1 z-40 w-[180px] flex flex-col animate-in fade-in zoom-in-95 duration-100">
                                <button 
                                    onClick={handleExportText}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                    导出为文本 (.txt)
                                </button>
                                <button 
                                    onClick={handleExportImage}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-700 flex items-center gap-2 border-b border-gray-100 pb-2 mb-1"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    导出为图片 (.png)
                                </button>
                                
                                {/* Favorites Actions */}
                                <button 
                                    onClick={() => {
                                        setShowExportMenu(false);
                                        setIsSelectionMode(true);
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                    多选收藏
                                </button>
                                <button 
                                    onClick={handleSaveAll}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm text-gray-700 flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                                    收藏全部
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Summarize Button (If Configured) */}
            {summaryAgent && (
                <button 
                    onClick={handleSummarize}
                    disabled={isProcessing}
                    className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded hover:bg-orange-100 flex items-center gap-1 transition-colors disabled:opacity-50 ml-auto mr-4"
                    title={`由 ${summaryAgent.name} 进行总结`}
                >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                    让 {summaryAgent.name} 总结
                </button>
            )}
            </div>

            {/* Text Input */}
            <textarea
            ref={textareaRef}
            className="flex-1 w-full bg-[#f5f5f5] resize-none px-4 py-1 text-[14px] text-gray-800 focus:outline-none placeholder-gray-400 custom-scrollbar font-normal"
            placeholder=""
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            />

            {/* Footer/Send Button */}
            <div className="h-[40px] px-4 md:px-6 flex items-center justify-end pb-2">
            <button 
                onClick={handleSendMessage}
                disabled={!inputText.trim() || isProcessing}
                className={`px-6 py-1.5 text-[14px] rounded-sm transition-colors ${
                inputText.trim() && !isProcessing
                    ? 'bg-[#e9e9e9] text-[#07c160] hover:bg-[#d2d2d2] font-medium' 
                    : 'bg-[#f5f5f5] text-gray-400 cursor-default'
                }`}
            >
                发送(S)
            </button>
            </div>
          </div>
      )}
      
      {/* Modals */}
      <ChatSettingsModal 
        isOpen={isChatSettingsOpen}
        onClose={() => setIsChatSettingsOpen(false)}
        chat={chat}
        allPersonas={allPersonas}
        onUpdateChat={onUpdateChat}
        onDeleteChat={onDeleteChat ? () => onDeleteChat(chat.id) : undefined}
        messages={messages} // Pass full history
        settings={settings} // Pass settings for API
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};

export default ChatWindow;
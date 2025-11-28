import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ContactList from './components/ContactList';
import FavoritesList from './components/FavoritesList';
import ChangelogList from './components/ChangelogList';
import ChatWindow from './components/ChatWindow';
import ChangelogView from './components/ChangelogView';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import { MOCK_CHATS, DEFAULT_PROVIDER_CONFIGS, AI_PERSONAS, MOCK_CHANGELOGS } from './constants';
import { AppSettings, Persona, ChatGroup, Favorite, Message, ChangelogEntry } from './types';

const INITIAL_ABOUT_CONTENT = `AI Round Table v1.5.0

主要功能：
- 多模型混合协作 (Gemini, DeepSeek, OpenAI)
- 角色扮演与群聊模拟
- 收藏夹与导出功能
- 实时思维链展示`;

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

const App: React.FC = () => {
  // Default to the first chat (the AI group)
  // We use functional initialization to load from localStorage if available
  const [chats, setChats] = useState<ChatGroup[]>(() => loadState('app_chats', MOCK_CHATS));
  const [selectedChatId, setSelectedChatId] = useState(chats.length > 0 ? chats[0].id : '');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Mobile UI state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: '123456' });

  // Sidebar Tab State
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chats' | 'contacts' | 'favorites' | 'changelog'>('chats');

  // About Modal State
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [aboutContent, setAboutContent] = useState(INITIAL_ABOUT_CONTENT);

  // Manage Personas State (Editable)
  const [personas, setPersonas] = useState<Persona[]>(() => loadState('app_personas', AI_PERSONAS));

  // Manage Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>(() => loadState('app_favorites', []));
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);

  // Manage Changelogs State
  const [changelogs, setChangelogs] = useState<ChangelogEntry[]>(() => loadState('app_changelogs', MOCK_CHANGELOGS));
  const [selectedLogId, setSelectedLogId] = useState<string | null>(changelogs.length > 0 ? changelogs[0].id : null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // App Settings State - Persisted
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = loadState<AppSettings | null>('app_settings', null);
    // Use defaults if no saved settings
    if (!saved) {
      return {
        userAvatar: 'https://picsum.photos/seed/me/100/100',
        userName: 'User',
        geminiModel: 'gemini-2.5-flash',
        enableThinking: false,
        activeProvider: 'qwen',
        providerConfigs: DEFAULT_PROVIDER_CONFIGS
      };
    }
    // Deep merge providerConfigs to handle new providers in code updates
    return {
        ...saved,
        providerConfigs: {
            ...DEFAULT_PROVIDER_CONFIGS,
            ...(saved.providerConfigs || {})
        }
    };
  });

  // Persist state changes
  useEffect(() => { localStorage.setItem('app_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('app_personas', JSON.stringify(personas)); }, [personas]);
  useEffect(() => { localStorage.setItem('app_favorites', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('app_changelogs', JSON.stringify(changelogs)); }, [changelogs]);
  useEffect(() => { localStorage.setItem('app_settings', JSON.stringify(settings)); }, [settings]);


  // Derived Active Content
  let activeContent = null;
  let activeLog = null;

  if (activeSidebarTab === 'favorites') {
      if (selectedFavoriteId) {
          const fav = favorites.find(f => f.id === selectedFavoriteId);
          if (fav) {
             // Construct a Read-Only ChatGroup Object for viewing
             activeContent = {
                 id: fav.id,
                 name: fav.title,
                 avatar: 'https://ui-avatars.com/api/?name=F&background=orange&color=fff',
                 members: [],
                 isReadOnly: true,
                 type: 'group',
                 // Hack: attach messages directly for ChatWindow to consume
                 messages: fav.messages 
             } as unknown as ChatGroup;
          }
      }
  } else if (activeSidebarTab === 'changelog') {
      activeLog = changelogs.find(l => l.id === selectedLogId);
  } else {
      activeContent = chats.find(c => c.id === selectedChatId);
  }

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
    // Check if a private chat already exists
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
  };

  return (
    <div className="flex h-full w-full bg-white select-none relative">
       {/* Sidebar - Hidden on mobile if chat is open */}
       <div className={`${isMobileChatOpen ? 'hidden md:flex' : 'flex'} flex-shrink-0 z-20 h-full`}>
           <Sidebar 
              userAvatar={settings.userAvatar}
              onOpenSettings={() => setIsSettingsOpen(true)}
              activeTab={activeSidebarTab}
              onTabChange={setActiveSidebarTab}
              onOpenAbout={() => setIsAboutModalOpen(true)}
           />
       </div>
       
       {/* List Pane - Hidden on mobile if chat is open */}
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

       {/* Chat Window / Content - Full screen on mobile if chat is open */}
       <div className={`
          ${isMobileChatOpen ? 'flex fixed inset-0 z-30 bg-white' : 'hidden'} 
          md:flex md:static md:flex-1 h-full w-full
       `}>
         {activeSidebarTab === 'changelog' ? (
             activeLog ? (
                 <>
                   {/* Mobile Back Button Wrapper for ChangelogView */}
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
          onUpdateSettings={setSettings}
          personas={personas}
          onUpdatePersonas={setPersonas}
          isAuthenticated={isAuthenticated}
          onLoginSuccess={() => setIsAuthenticated(true)}
          adminCredentials={adminCredentials}
          onUpdateAdminCredentials={setAdminCredentials}
          onLogout={handleLogout}
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
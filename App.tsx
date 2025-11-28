import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatList from './components/ChatList';
import ContactList from './components/ContactList';
import FavoritesList from './components/FavoritesList';
import ChatWindow from './components/ChatWindow';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import { MOCK_CHATS, DEFAULT_PROVIDER_CONFIGS, AI_PERSONAS, MOCK_CHANGELOGS } from './constants';
import { AppSettings, Persona, ChatGroup, Favorite, Message } from './types';

const INITIAL_ABOUT_CONTENT = `AI Round Table v1.5.0

一款基于 Google Gemini 等多模型驱动的 AI 群聊模拟器。

主要功能：
- 多角色扮演与混合协作
- 支持 Gemini, DeepSeek, OpenAI 等多种模型
- 聊天记录收藏与导出
- 实时思维链 (Thinking) 展示

更新日志：
2025-05-20 v1.5.0: 新增 DeepSeek R1 支持
2025-05-10 v1.2.0: 收藏夹功能上线
2025-04-01 v1.0.0: 初始版本发布`;

const App: React.FC = () => {
  // Default to the first chat (the AI group)
  const [selectedChatId, setSelectedChatId] = useState(MOCK_CHATS[0].id);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Mobile UI state
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  
  // About/Version Intro Modal State
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [aboutContent, setAboutContent] = useState(INITIAL_ABOUT_CONTENT);
  
  // Authentication State (Lifted from SettingsModal)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Admin Credentials State
  const [adminCredentials, setAdminCredentials] = useState({ username: 'admin', password: '123456' });

  // Sidebar Tab State
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chats' | 'contacts' | 'favorites'>('chats');

  // Manage Chats State (Editable)
  const [chats, setChats] = useState<ChatGroup[]>(MOCK_CHATS);

  // Manage Personas State (Editable)
  const [personas, setPersonas] = useState<Persona[]>(AI_PERSONAS);

  // Manage Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // App Settings State
  const [settings, setSettings] = useState<AppSettings>({
    userAvatar: 'https://picsum.photos/seed/me/100/100',
    userName: 'User',
    geminiModel: 'gemini-2.5-flash',
    enableThinking: false,
    activeProvider: 'gemini',
    providerConfigs: DEFAULT_PROVIDER_CONFIGS
  });

  // Derived Active Content
  let activeContent = null;

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
       </div>

       {/* Chat Window / Content - Full screen on mobile if chat is open */}
       <div className={`
          ${isMobileChatOpen ? 'flex fixed inset-0 z-30 bg-white' : 'hidden'} 
          md:flex md:static md:flex-1 h-full w-full
       `}>
         {activeContent ? (
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
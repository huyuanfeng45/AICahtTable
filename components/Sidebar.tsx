import React from 'react';

interface SidebarProps {
  userAvatar: string;
  onOpenSettings: () => void;
  activeTab: 'chats' | 'contacts' | 'favorites' | 'changelog' | 'moments';
  onTabChange: (tab: 'chats' | 'contacts' | 'favorites' | 'changelog' | 'moments') => void;
  onOpenAbout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ userAvatar, onOpenSettings, activeTab, onTabChange, onOpenAbout }) => {
  return (
    <div className="w-[60px] h-full bg-[#2e2e2e] flex flex-col items-center py-6 flex-shrink-0 z-20">
      {/* User Avatar */}
      <div className="mb-8 cursor-pointer relative group" onClick={onOpenSettings} title="点击修改头像">
         <img 
           src={userAvatar} 
           alt="User" 
           className="w-9 h-9 rounded bg-white object-cover"
         />
         <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all"></div>
      </div>

      {/* Nav Icons */}
      <div className="flex flex-col gap-6 w-full items-center">
        {/* Chat Icon - Active */}
        <div 
            className={`cursor-pointer relative group transition-colors ${activeTab === 'chats' ? 'text-[#07c160]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onTabChange('chats')}
            title="会话"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="opacity-100">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.487 3.53 1.338 5.025L2.5 21.5l4.475-.838A9.974 9.974 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zM9 10a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
          </svg>
        </div>

        {/* Contacts Icon */}
        <div 
            className={`cursor-pointer relative group transition-colors ${activeTab === 'contacts' ? 'text-[#07c160]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onTabChange('contacts')}
            title="通讯录 / 角色私聊"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
             <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
             <circle cx="9" cy="7" r="4"></circle>
             <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
             <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>

        {/* Cube/Box Icon (Favorites) */}
        <div 
            className={`cursor-pointer relative group transition-colors ${activeTab === 'favorites' ? 'text-[#07c160]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onTabChange('favorites')}
            title="收藏箱"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        </div>

        {/* Changelog Icon */}
        <div 
            className={`cursor-pointer relative group transition-colors ${activeTab === 'changelog' ? 'text-[#07c160]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onTabChange('changelog')}
            title="更新日志"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>

        {/* Moments Icon (New) */}
        <div 
            className={`cursor-pointer relative group transition-colors ${activeTab === 'moments' ? 'text-[#07c160]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => onTabChange('moments')}
            title="朋友圈"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
            <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
            <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
            <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
            <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
            <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
          </svg>
        </div>
      </div>
      
      {/* Bottom Icons */}
      <div className="mt-auto flex flex-col gap-6 items-center w-full pb-4">
         {/* Settings Icon */}
         <div 
            className="text-gray-400 hover:text-white cursor-pointer transition-colors"
            onClick={onOpenSettings}
            title="后台设置"
         >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>
        
        {/* Menu Icon (About/Function Intro) */}
        <div 
          className="text-gray-400 hover:text-white cursor-pointer transition-colors"
          onClick={onOpenAbout}
          title="功能介绍"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
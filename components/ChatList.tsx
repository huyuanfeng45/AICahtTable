import React from 'react';
import { ChatGroup } from '../types';

interface ChatListProps {
  chats: ChatGroup[];
  selectedChatId: string;
  onSelectChat: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddChat: () => void;
}

const ChatList: React.FC<ChatListProps> = ({ 
  chats, 
  selectedChatId, 
  onSelectChat,
  searchQuery,
  onSearchChange,
  onAddChat
}) => {
  return (
    <div className="w-full md:w-[250px] h-full bg-[#f7f7f7] border-r border-[#d6d6d6] flex flex-col flex-shrink-0">
      {/* Search Bar */}
      <div className="p-3 bg-[#f7f7f7] pt-6 flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <input 
            type="text" 
            placeholder="搜索" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#e2e2e2] text-sm text-gray-700 rounded-md pl-8 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-500 text-xs h-[28px]"
          />
        </div>
        <button 
            onClick={onAddChat}
            className="bg-[#e2e2e2] hover:bg-[#d6d6d6] text-gray-600 rounded-md p-1 w-[28px] h-[28px] flex items-center justify-center transition-colors"
            title="新建群聊"
        >
           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
             <line x1="12" y1="5" x2="12" y2="19"></line>
             <line x1="5" y1="12" x2="19" y2="12"></line>
           </svg>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {chats.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-4">
                没有找到相关群聊
            </div>
        ) : (
            chats.map((chat) => (
            <div 
                key={chat.id} 
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center p-3 cursor-pointer select-none transition-colors ${
                selectedChatId === chat.id 
                    ? 'bg-[#c6c6c6] bg-opacity-40' 
                    : 'hover:bg-[#dcdcdc] hover:bg-opacity-50'
                }`}
            >
                <div className="relative">
                <img 
                    src={chat.avatar} 
                    alt={chat.name} 
                    className="w-10 h-10 rounded-sm object-cover" 
                />
                {chat.unreadCount ? (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] px-1 min-w-[16px] h-[16px] rounded-full flex items-center justify-center z-10">
                    {chat.unreadCount}
                    </div>
                ) : null}
                </div>
                
                <div className="ml-3 flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className="text-[13px] font-medium text-gray-900 truncate">{chat.name}</h3>
                    <span className="text-[10px] text-gray-400">{chat.timestamp}</span>
                </div>
                <p className="text-[11px] text-gray-500 truncate">{chat.lastMessage}</p>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ChatList;
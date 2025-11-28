import React from 'react';
import { Message, Persona } from '../types';

interface MessageBubbleProps {
  message: Message;
  persona?: Persona; // Only if it's an AI message
  userAvatar?: string;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onFavorite?: (msg: Message) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  persona, 
  userAvatar,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onFavorite
}) => {
  const isUser = message.isUser;
  
  if (message.isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">{message.content}</span>
      </div>
    );
  }

  return (
    <div className={`flex w-full mb-4 items-start group ${selectionMode ? 'pl-2' : ''} ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      
      {/* Checkbox for Selection Mode */}
      {selectionMode && (
          <div className={`flex items-center justify-center self-center mx-2 ${isUser ? 'order-last' : 'order-first'}`}>
             <input 
               type="checkbox"
               checked={isSelected}
               onChange={() => onToggleSelect && onToggleSelect(message.id)}
               className="w-5 h-5 rounded-full border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
             />
          </div>
      )}

      {/* Avatar */}
      <div className={`flex-shrink-0 ${selectionMode ? '' : ''}`}>
        <img 
          src={isUser ? (userAvatar || "https://picsum.photos/seed/me/100/100") : persona?.avatar || "https://picsum.photos/seed/unknown/100/100"} 
          alt="Avatar" 
          className="w-9 h-9 rounded-sm bg-gray-200 object-cover"
        />
      </div>

      {/* Content Container */}
      <div className={`flex flex-col max-w-[70%] relative ${isUser ? 'mr-3 items-end' : 'ml-3 items-start'}`}>
        
        {/* Name (only for AI) */}
        {!isUser && (
           <div className="flex items-baseline mb-1">
             <span className="text-xs text-gray-500 select-none mr-2">{persona?.name}</span>
             <span className={`text-[10px] border px-1 rounded ${persona?.color?.replace('text-', 'border-').replace('600', '200') || 'border-gray-200'} text-gray-400`}>
                {persona?.role}
             </span>
           </div>
        )}

        {/* Bubble */}
        <div 
          className={`relative px-3 py-2 text-[14px] leading-relaxed rounded-md break-words shadow-sm group-hover:shadow-md transition-shadow ${
            isUser 
              ? 'bg-[#95ec69] text-black' 
              : 'bg-white text-gray-800 border border-gray-100'
          }`}
        >
          {/* Triangle for Bubble */}
          <div 
            className={`absolute top-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ${
                isUser 
                ? '-right-[6px] border-l-[6px] border-l-[#95ec69]' 
                : '-left-[6px] border-r-[6px] border-r-white'
            }`}
          ></div>

           {message.content}

           {/* Quick Favorite Icon (Only show when NOT in selection mode) */}
           {!selectionMode && onFavorite && (
               <button 
                  onClick={(e) => {
                      e.stopPropagation();
                      onFavorite(message);
                  }}
                  className={`absolute opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-gray-200 shadow-sm rounded-full p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 z-10 ${
                      isUser ? '-left-10 bottom-0' : '-right-10 bottom-0'
                  }`}
                  title="收藏此消息"
               >
                   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                     <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                     <line x1="12" y1="22.08" x2="12" y2="12"></line>
                   </svg>
               </button>
           )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
import React from 'react';
import { Persona } from '../types';
import { MODEL_PROVIDERS } from '../constants';

interface ContactListProps {
  personas: Persona[];
  onSelectContact: (persona: Persona) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ContactList: React.FC<ContactListProps> = ({ 
  personas, 
  onSelectContact,
  searchQuery,
  onSearchChange
}) => {
  const filteredPersonas = personas.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full md:w-[250px] h-full bg-[#f7f7f7] border-r border-[#d6d6d6] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-3 bg-[#f7f7f7] pt-6 flex flex-col gap-2 border-b border-[#e5e5e5]">
        <h2 className="text-xs font-bold text-gray-500 px-1">通讯录</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <input 
            type="text" 
            placeholder="搜索角色" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#e2e2e2] text-sm text-gray-700 rounded-md pl-8 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-500 text-xs h-[28px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {/* Category Header */}
        <div className="px-3 py-1 bg-[#ededed] text-[10px] text-gray-500 sticky top-0">AI 助手 ({filteredPersonas.length})</div>
        
        {filteredPersonas.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-4">
                未找到相关角色
            </div>
        ) : (
            filteredPersonas.map((persona) => {
              const providerInfo = MODEL_PROVIDERS.find(p => p.id === (persona.config?.provider || 'gemini'));
              return (
                <div 
                    key={persona.id} 
                    onClick={() => onSelectContact(persona)}
                    className="flex items-center p-3 cursor-pointer select-none transition-colors hover:bg-[#dcdcdc] hover:bg-opacity-50"
                >
                    <div className="relative">
                    <img 
                        src={persona.avatar} 
                        alt={persona.name} 
                        className="w-9 h-9 rounded-md object-cover bg-gray-200" 
                    />
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-[1px]">
                         <img src={providerInfo?.icon} className="w-3 h-3 rounded-full" />
                    </div>
                    </div>
                    
                    <div className="ml-3 flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="text-[13px] font-medium text-gray-900 truncate">{persona.name}</h3>
                    </div>
                    <p className="text-[10px] text-gray-500 truncate">{persona.role}</p>
                    </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default ContactList;
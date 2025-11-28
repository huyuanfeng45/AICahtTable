
import React from 'react';
import { ChangelogEntry } from '../types';

interface ChangelogListProps {
  logs: ChangelogEntry[];
  selectedLogId: string | null;
  onSelectLog: (id: string) => void;
  onAddLog: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isAuthenticated: boolean;
}

const ChangelogList: React.FC<ChangelogListProps> = ({ 
  logs, 
  selectedLogId, 
  onSelectLog,
  onAddLog,
  searchQuery,
  onSearchChange,
  isAuthenticated
}) => {
  const filteredLogs = logs.filter(log => 
    log.version.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-[250px] h-full bg-[#f7f7f7] border-r border-[#d6d6d6] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-3 bg-[#f7f7f7] pt-6 flex flex-col gap-2 border-b border-[#e5e5e5]">
        <div className="flex justify-between items-center px-1">
             <h2 className="text-xs font-bold text-gray-500">更新日志</h2>
             {isAuthenticated && (
                <button 
                    onClick={onAddLog}
                    className="text-gray-500 hover:text-green-600 transition-colors"
                    title="发布新版本"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
             )}
        </div>
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <input 
            type="text" 
            placeholder="搜索版本..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#e2e2e2] text-sm text-gray-700 rounded-md pl-8 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-500 text-xs h-[28px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredLogs.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-4">
                暂无更新记录
            </div>
        ) : (
            filteredLogs.map((log) => (
            <div 
                key={log.id} 
                onClick={() => onSelectLog(log.id)}
                className={`group flex items-center p-3 cursor-pointer select-none transition-colors border-b border-gray-100 ${
                selectedLogId === log.id 
                    ? 'bg-[#c6c6c6] bg-opacity-40' 
                    : 'hover:bg-[#dcdcdc] hover:bg-opacity-50'
                }`}
            >
                {/* Version Badge */}
                <div className={`w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-mono mr-3 border ${selectedLogId === log.id ? 'bg-white border-transparent text-gray-800' : 'bg-white border-gray-200 text-gray-500'}`}>
                    {log.version.split('.').slice(0,2).join('.')}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="text-[13px] font-medium text-gray-900 truncate">{log.version}</h3>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">
                            {log.date}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">
                        {log.title}
                    </p>
                </div>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default ChangelogList;

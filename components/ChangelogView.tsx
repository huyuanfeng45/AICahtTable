
import React, { useState, useEffect } from 'react';
import { ChangelogEntry } from '../types';

interface ChangelogViewProps {
  log: ChangelogEntry;
  onUpdate: (updatedLog: ChangelogEntry) => void;
  onDelete: (id: string) => void;
  isAuthenticated: boolean;
}

const ChangelogView: React.FC<ChangelogViewProps> = ({ log, onUpdate, onDelete, isAuthenticated }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [version, setVersion] = useState(log.version);
  const [date, setDate] = useState(log.date);
  const [title, setTitle] = useState(log.title);
  const [content, setContent] = useState(log.content);

  // Reset form when log changes
  useEffect(() => {
    setVersion(log.version);
    setDate(log.date);
    setTitle(log.title);
    setContent(log.content);
    setIsEditing(false); // Exit edit mode when switching logs
  }, [log]);

  const handleSave = () => {
    onUpdate({
      ...log,
      version,
      date,
      title,
      content
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setVersion(log.version);
    setDate(log.date);
    setTitle(log.title);
    setContent(log.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
      if (window.confirm("确定要删除这条更新日志吗？")) {
          onDelete(log.id);
      }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Header */}
      <div className="h-[60px] border-b border-[#e7e7e7] bg-[#f5f5f5] flex items-center justify-between px-6 flex-shrink-0 select-none">
        <div>
           <h2 className="text-[16px] font-medium text-gray-900 flex items-center gap-2">
             更新详情
             <span className="bg-gray-200 text-gray-600 text-[10px] px-1.5 py-0.5 rounded font-mono">
                {isEditing ? 'Editing' : 'Read-Only'}
             </span>
           </h2>
        </div>
        <div className="flex items-center gap-3">
           {!isEditing ? (
               isAuthenticated && (
                   <>
                     <button 
                        onClick={handleDelete}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                     </button>
                     <button 
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                     >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        编辑
                     </button>
                   </>
               )
           ) : (
               <div className="flex gap-2">
                   <button 
                        onClick={handleCancel}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
                   >
                        取消
                   </button>
                   <button 
                        onClick={handleSave}
                        className="px-3 py-1.5 bg-[#07c160] text-white rounded text-xs hover:bg-[#06ad56] transition-colors shadow-sm"
                   >
                        保存
                   </button>
               </div>
           )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 max-w-4xl mx-auto w-full">
         {isEditing ? (
             <div className="space-y-6 animate-in fade-in duration-300">
                 <div className="grid grid-cols-2 gap-6">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Version</label>
                         <input 
                            type="text" 
                            value={version} 
                            onChange={e => setVersion(e.target.value)}
                            className="w-full border-b border-gray-300 py-1 text-lg font-mono focus:outline-none focus:border-green-500 transition-colors"
                         />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Date</label>
                         <input 
                            type="date" 
                            value={date} 
                            onChange={e => setDate(e.target.value)}
                            className="w-full border-b border-gray-300 py-1 text-lg focus:outline-none focus:border-green-500 transition-colors"
                         />
                     </div>
                 </div>
                 
                 <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Title</label>
                     <input 
                        type="text" 
                        value={title} 
                        onChange={e => setTitle(e.target.value)}
                        className="w-full border-b border-gray-300 py-1 text-xl font-medium focus:outline-none focus:border-green-500 transition-colors"
                     />
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Content</label>
                     <textarea 
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        className="w-full h-[400px] border border-gray-200 rounded p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none font-mono bg-gray-50"
                     />
                 </div>
             </div>
         ) : (
             <div className="animate-in fade-in duration-300">
                 <div className="mb-8 border-b border-gray-100 pb-6">
                     <div className="flex items-center gap-3 mb-2">
                         <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-sm font-mono font-medium">{version}</span>
                         <span className="text-gray-400 text-sm">{date}</span>
                     </div>
                     <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                 </div>
                 
                 <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                     {content}
                 </div>
             </div>
         )}
      </div>
    </div>
  );
};

export default ChangelogView;

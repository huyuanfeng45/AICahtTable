import React, { useState, useEffect } from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onUpdateContent: (newContent: string) => void;
  isAuthenticated: boolean;
}

const AboutModal: React.FC<AboutModalProps> = ({ 
  isOpen, 
  onClose, 
  content, 
  onUpdateContent, 
  isAuthenticated 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content);

  useEffect(() => {
    setLocalContent(content);
  }, [content, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateContent(localContent);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-[500px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">软件介绍</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar">
            {isEditing ? (
                <textarea 
                    className="w-full h-[300px] border border-gray-300 rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none font-mono bg-gray-50"
                    value={localContent}
                    onChange={e => setLocalContent(e.target.value)}
                    placeholder="输入软件介绍内容..."
                />
            ) : (
                <div className="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {content || '暂无介绍内容'}
                </div>
            )}
        </div>

        {isAuthenticated && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                {isEditing ? (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                setIsEditing(false);
                                setLocalContent(content);
                            }} 
                            className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded transition-colors"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="px-3 py-1.5 text-xs bg-[#07c160] text-white rounded hover:bg-[#06ad56] transition-colors"
                        >
                            保存
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => setIsEditing(true)} 
                        className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-1"
                    >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                        编辑内容
                    </button>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default AboutModal;
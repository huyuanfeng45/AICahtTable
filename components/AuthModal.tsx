
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface AuthModalProps {
  users: UserProfile[];
  onLogin: (user: UserProfile) => void;
  onRegister: (name: string) => void;
  onDeleteUser: (id: string) => void;
  onValidateAdmin: (u: string, p: string) => boolean;
  onAdminLoginSuccess: () => void;
  syncStatus?: string;
  ossConnectStatus?: 'idle' | 'connecting' | 'connected' | 'error';
}

const AuthModal: React.FC<AuthModalProps> = ({ 
  users, 
  onLogin, 
  onRegister, 
  onDeleteUser,
  onValidateAdmin,
  onAdminLoginSuccess,
  syncStatus,
  ossConnectStatus
}) => {
  // If we have users, default to login view, otherwise register
  const [view, setView] = useState<'login' | 'register'>(users.length > 0 ? 'login' : 'register');
  const [newName, setNewName] = useState('');
  
  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleRegister = () => {
    if (!newName.trim()) return;
    onRegister(newName.trim());
    setNewName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRegister();
  };

  const handleAdminSubmit = () => {
      if (onValidateAdmin(adminUser, adminPass)) {
          onAdminLoginSuccess();
      } else {
          setAdminError('认证失败');
      }
  };

  return (
    <div className="fixed inset-0 bg-[#f0f2f5] z-[100] flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] relative">
        
        {/* Admin Login Button (Top Right) */}
        {!showAdminLogin && (
            <div className="absolute top-3 right-3 z-10">
                <button 
                    onClick={() => setShowAdminLogin(true)}
                    className="p-2 text-gray-300 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                    title="管理员登录"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </button>
            </div>
        )}

        {/* Header */}
        <div className="p-8 pb-4 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">AI Round Table</h1>
            <p className="text-gray-500 text-sm mt-2">
                {showAdminLogin ? '管理员后台登录' : (view === 'login' ? '选择账号进入聊天' : '创建一个新身份')}
            </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
            
            {showAdminLogin ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Admin Account</label>
                        <input 
                            type="text" 
                            value={adminUser}
                            onChange={(e) => setAdminUser(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-shadow"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input 
                            type="password" 
                            value={adminPass}
                            onChange={(e) => setAdminPass(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-shadow"
                        />
                    </div>
                    {adminError && <p className="text-red-500 text-sm">{adminError}</p>}
                    
                    <button 
                        onClick={handleAdminSubmit}
                        className="w-full bg-gray-800 text-white py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors shadow-md"
                    >
                        登录
                    </button>
                    <button 
                        onClick={() => {
                            setShowAdminLogin(false);
                            setAdminError('');
                            setAdminPass('');
                        }}
                        className="w-full text-gray-500 py-2 text-sm hover:text-gray-800 transition-colors"
                    >
                        返回
                    </button>
                </div>
            ) : view === 'login' ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {users.map(user => (
                            <div 
                                key={user.id} 
                                className="relative group border border-gray-200 rounded-xl p-4 flex flex-col items-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all"
                                onClick={() => onLogin(user)}
                            >
                                <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full bg-gray-200 object-cover mb-3" />
                                <span className="font-medium text-gray-800 truncate w-full text-center text-sm">{user.name}</span>
                                
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (window.confirm(`确定要删除用户 "${user.name}" 吗? 所有相关数据将丢失。`)) {
                                            onDeleteUser(user.id);
                                        }
                                    }}
                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ))}
                        
                        {/* Add User Button */}
                        <div 
                            onClick={() => setView('register')}
                            className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-green-500 hover:bg-gray-50 text-gray-400 hover:text-green-600 transition-all min-h-[140px]"
                        >
                             <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                             <span className="text-sm font-medium">添加账号</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 relative">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                        <input 
                            type="text" 
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow"
                            placeholder="例如：极客小张"
                            autoFocus
                        />
                         <p className="text-xs text-gray-400 mt-2">* 无需密码，注册即登录</p>
                    </div>

                    <button 
                        onClick={handleRegister}
                        disabled={!newName.trim()}
                        className="w-full bg-[#07c160] text-white py-3 rounded-lg font-medium hover:bg-[#06ad56] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-green-200"
                    >
                        立即注册并登录
                    </button>

                    {users.length > 0 && (
                        <button 
                            onClick={() => setView('login')}
                            className="w-full text-gray-500 py-2 text-sm hover:text-gray-800 transition-colors"
                        >
                            返回账号列表
                        </button>
                    )}
                </div>
            )}
        </div>
        
        {/* Footer with Sync Status */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Version 1.5.0 - by:HYF</span>
                {/* Connection Indicator */}
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-100 rounded-full shadow-sm">
                   <div className={`w-2 h-2 rounded-full ${
                       ossConnectStatus === 'connected' ? 'bg-green-500' :
                       ossConnectStatus === 'error' ? 'bg-red-500' :
                       ossConnectStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                       'bg-gray-300'
                   }`}></div>
                   <span className={`text-[10px] font-medium ${
                       ossConnectStatus === 'connected' ? 'text-green-600' :
                       ossConnectStatus === 'error' ? 'text-red-600' :
                       ossConnectStatus === 'connecting' ? 'text-yellow-600' :
                       'text-gray-400'
                   }`}>
                       {ossConnectStatus === 'connected' ? '数据库已连接' :
                        ossConnectStatus === 'error' ? '连接失败' :
                        ossConnectStatus === 'connecting' ? '连接中...' :
                        '未连接云端'}
                   </span>
                </div>
            </div>

            {syncStatus && (
                <div className={`text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                    syncStatus.includes('失败') ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                }`}>
                    {!syncStatus.includes('失败') && (
                        <svg className="animate-spin w-2.5 h-2.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    )}
                    {syncStatus}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;

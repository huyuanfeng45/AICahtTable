

import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppSettings, MomentPost, MomentLike, MomentComment } from '../types';
import { generateMomentInteractions, generateMomentPost } from '../services/geminiService';
import { DEFAULT_APP_SETTINGS } from '../constants';

interface MomentsViewProps {
  currentUser: UserProfile | null;
  posts: MomentPost[];
  onUpdatePosts: (posts: MomentPost[]) => void;
  onUpdateUser?: (updates: Partial<UserProfile>) => void;
}

const MomentsView: React.FC<MomentsViewProps> = ({ currentUser, posts, onUpdatePosts, onUpdateUser }) => {
  const [isPosting, setIsPosting] = useState(false);
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // AI Config State
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiConfig, setAiConfig] = useState({
      enabled: false,
      likeCount: 5,
      commentCount: 3
  });

  // AI Auto Post State
  const [showPostOptions, setShowPostOptions] = useState(false);
  const [showAiPostModal, setShowAiPostModal] = useState(false);
  const [aiPostTopic, setAiPostTopic] = useState('');
  const [aiTimeValue, setAiTimeValue] = useState(0); // 0-180 minutes
  const [aiImageCount, setAiImageCount] = useState(4);
  const [aiLikeCount, setAiLikeCount] = useState(10);
  const [aiCommentCount, setAiCommentCount] = useState(5);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);

  // Navigation State
  const [viewingUser, setViewingUser] = useState<{name: string, avatar: string} | null>(null);
  const [viewingPost, setViewingPost] = useState<MomentPost | null>(null);

  // Load settings for API calls
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  useEffect(() => {
      const saved = localStorage.getItem('app_global_settings');
      if (saved) {
          try {
             const parsed = JSON.parse(saved);
             setSettings(prev => ({ ...prev, ...parsed }));
          } catch(e) {}
      }
  }, []);

  const handlePostMoment = () => {
      setIsPosting(true);
      setShowAiConfig(false);
  };

  const handleCancelPost = () => {
      setIsPosting(false);
      setPostText('');
      setSelectedImages([]);
      setAiConfig({ enabled: false, likeCount: 5, commentCount: 3 });
  };

  const handleSubmitPost = async () => {
      if (!postText.trim() && selectedImages.length === 0) return;
      
      const newPostId = Date.now();
      const newPost: MomentPost = {
          id: newPostId,
          user: {
              name: currentUser?.name || '我',
              avatar: currentUser?.avatar || "https://picsum.photos/seed/me/100/100"
          },
          content: postText,
          images: selectedImages,
          time: '刚刚',
          likes: [],
          comments: []
      };
      
      // Optimistic update
      onUpdatePosts([newPost, ...posts]);
      
      // Close UI
      setIsPosting(false);
      setPostText('');
      setSelectedImages([]);
      
      // Async AI Generation
      if (aiConfig.enabled && (aiConfig.likeCount > 0 || aiConfig.commentCount > 0)) {
          try {
              const interactions = await generateMomentInteractions(
                  newPost.content || "Image post", 
                  aiConfig.likeCount, 
                  aiConfig.commentCount, 
                  settings
              );
              
              // Map likes to include avatars (Use picsum for photo-like avatars)
              const enrichedLikes: MomentLike[] = interactions.likes.map(name => ({
                  name,
                  avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`
              }));
              
              // Map comments to include avatars and time
              const enrichedComments: MomentComment[] = interactions.comments.map(c => ({
                  ...c,
                  avatar: `https://picsum.photos/seed/${encodeURIComponent(c.name)}/200/200`,
                  time: '刚刚'
              }));

              // Update the post with generated data
              onUpdatePosts([
                  {
                      ...newPost,
                      likes: enrichedLikes,
                      comments: enrichedComments
                  },
                  ...posts
              ]);
          } catch (e) {
              console.error("Failed to generate AI interactions", e);
          }
      }
  };

  const formatTime = (minutes: number) => {
      if (minutes <= 0) return '刚刚';
      if (minutes < 60) return `${minutes}分钟前`;
      const hours = Math.floor(minutes / 60);
      return `${hours}小时前`;
  };

  const handleGenerateAiPost = async () => {
    setIsGeneratingPost(true);
    try {
        const result = await generateMomentPost(aiPostTopic, aiImageCount, aiLikeCount, aiCommentCount, settings);
        
        // Construct Avatar URL
        const avatarUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(result.avatarPrompt)}?width=200&height=200&nologo=true&seed=${Math.random()}`;
        
        // Construct Image URLs
        const imageUrls = result.imagePrompts ? result.imagePrompts.map((prompt, idx) => 
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=800&nologo=true&seed=${Math.random() + idx}`
        ) : [];

        // Enrich Likes with avatars (Use picsum for realistic look)
        const enrichedLikes: MomentLike[] = result.likes ? result.likes.map(name => ({
            name,
            avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`
        })) : [];
        
        // Enrich Comments
        const enrichedComments: MomentComment[] = result.comments ? result.comments.map(c => ({
            ...c,
            avatar: `https://picsum.photos/seed/${encodeURIComponent(c.name)}/200/200`,
            time: '刚刚'
        })) : [];

        const newPost: MomentPost = {
            id: Date.now(),
            user: {
                name: result.userName,
                avatar: avatarUrl
            },
            content: result.content,
            images: imageUrls,
            time: formatTime(aiTimeValue),
            likes: enrichedLikes,
            comments: enrichedComments
        };

        onUpdatePosts([newPost, ...posts]);
        setShowAiPostModal(false);
        setAiPostTopic('');
        setAiTimeValue(0);
        setAiImageCount(4);
        setAiLikeCount(10);
        setAiCommentCount(5);
    } catch (e) {
        console.error(e);
        alert('生成失败');
    } finally {
        setIsGeneratingPost(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 9 - selectedImages.length;
      const filesToProcess = files.slice(0, remainingSlots);

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result && typeof ev.target.result === 'string') {
            setSelectedImages(prev => {
                if (prev.length >= 9) return prev;
                return [...prev, ev.target!.result as string];
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = ''; 
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 2 * 1024 * 1024) {
              alert("图片大小不能超过 2MB");
              return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
              const result = ev.target?.result as string;
              if (result && onUpdateUser) {
                  onUpdateUser({ avatar: result });
              }
          };
          reader.readAsDataURL(file);
      }
      if (e.target) e.target.value = '';
  };
  
  const handleDeletePost = (postId: number) => {
      if (window.confirm('确定删除这条朋友圈吗？')) {
          onUpdatePosts(posts.filter(p => p.id !== postId));
          if (viewingPost?.id === postId) {
              setViewingPost(null);
          }
      }
  };

  // --- View: Post Detail ---
  if (viewingPost) {
      return (
          <div className="flex-1 h-full bg-white flex flex-col z-50 absolute inset-0 md:static animate-in slide-in-from-right duration-200">
              {/* Header */}
              <div className="h-[50px] border-b border-gray-100 flex items-center justify-between px-4 bg-white flex-shrink-0">
                  <button 
                    onClick={() => setViewingPost(null)} 
                    className="p-1 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full"
                  >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  <h3 className="text-[16px] font-medium text-gray-900">详情</h3>
                  <button className="p-1 -mr-2 text-gray-700 hover:bg-gray-100 rounded-full">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path></svg>
                  </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                  <div className="p-4 md:p-6 pb-20">
                      <div className="flex gap-3 items-start">
                          {/* Left Column: Avatar */}
                          <img 
                            src={viewingPost.user.avatar} 
                            alt="Avatar" 
                            className="w-10 h-10 rounded-lg object-cover bg-gray-200 flex-shrink-0"
                            onClick={() => {
                                setViewingPost(null);
                                setViewingUser(viewingPost.user);
                            }}
                          />

                          {/* Right Column: Content & Interactions */}
                          <div className="flex-1 min-w-0 pt-0.5">
                              {/* Name */}
                              <div className="text-[16px] font-bold text-[#576b95] leading-tight mb-1">
                                  {viewingPost.user.name}
                              </div>

                              {/* Content */}
                              <div className="text-[15px] text-gray-900 leading-relaxed whitespace-pre-wrap mb-2">
                                  {viewingPost.content}
                              </div>
                              
                              {/* Images */}
                              {viewingPost.images.length > 0 && (
                                  <div className={`grid gap-1.5 mb-2 ${
                                      viewingPost.images.length === 1 ? 'grid-cols-1 max-w-[200px]' : 
                                      viewingPost.images.length === 2 || viewingPost.images.length === 4 ? 'grid-cols-2 max-w-[200px]' : 
                                      'grid-cols-3 max-w-[280px]'
                                  }`}>
                                      {viewingPost.images.map((img, idx) => (
                                          <div key={idx} className={`aspect-square bg-gray-100 overflow-hidden ${viewingPost.images.length === 1 ? 'aspect-auto' : ''}`}>
                                              <img src={img} className="w-full h-full object-cover" alt={`Img ${idx}`} />
                                          </div>
                                      ))}
                                  </div>
                              )}
                              
                              {/* Meta & Delete */}
                              <div className="flex items-center justify-between mt-2 mb-4">
                                  <div className="flex items-center gap-3 text-xs text-gray-400">
                                      <span>2025年11月30日 20:18</span>
                                      {(viewingPost.user.name === currentUser?.name || viewingPost.id > 2) && (
                                          <button onClick={() => handleDeletePost(viewingPost.id)}>
                                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                          </button>
                                      )}
                                  </div>
                                  <div className="bg-[#f7f7f7] px-2 rounded-[4px] text-[#576b95] font-bold tracking-widest cursor-pointer hover:bg-gray-200 transition-colors">
                                     ••
                                  </div>
                              </div>

                              {/* Interaction Section (Aligned right) */}
                              <div className="bg-[#f7f7f7] rounded-[4px] p-3 relative mt-3">
                                   {/* Triangle */}
                                   <div className="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]"></div>

                                   {/* Likes */}
                                   {viewingPost.likes.length > 0 && (
                                       <div className="flex items-start pb-2.5 border-b border-gray-200 mb-2.5">
                                           <div className="w-6 flex-shrink-0 pt-1">
                                              <svg className="w-4 h-4 text-[#576b95]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                           </div>
                                           <div className="flex-1 flex flex-wrap gap-1.5">
                                               {viewingPost.likes.map((like, i) => (
                                                   <img 
                                                     key={i}
                                                     src={like.avatar} 
                                                     alt={like.name}
                                                     className="w-8 h-8 rounded-md bg-gray-200 object-cover" 
                                                     title={like.name}
                                                   />
                                               ))}
                                           </div>
                                       </div>
                                   )}

                                   {/* Comments */}
                                   {viewingPost.comments.length > 0 ? (
                                       <div className="flex items-start">
                                            <div className="w-6 flex-shrink-0 pt-2">
                                                <svg className="w-4 h-4 text-[#576b95]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
                                            </div>
                                            <div className="flex-1 space-y-3">
                                               {viewingPost.comments.map((comment, i) => (
                                                   <div key={i} className="flex gap-2.5 items-start">
                                                       <img 
                                                         src={comment.avatar || `https://picsum.photos/seed/${encodeURIComponent(comment.name)}/200/200`} 
                                                         className="w-8 h-8 rounded-md bg-gray-200 object-cover mt-0.5 flex-shrink-0" 
                                                         alt="Avatar"
                                                       />
                                                       <div className="flex-1 min-w-0">
                                                           <div className="flex justify-between items-baseline">
                                                               <span className="text-[#576b95] text-[13px] font-medium leading-tight truncate pr-2">{comment.name}</span>
                                                               <span className="text-gray-400 text-[10px] leading-tight flex-shrink-0">{comment.time || '刚刚'}</span>
                                                           </div>
                                                           <div className="text-[14px] text-gray-800 leading-normal break-words mt-0.5">
                                                               {comment.content}
                                                           </div>
                                                       </div>
                                                   </div>
                                               ))}
                                            </div>
                                       </div>
                                   ) : (
                                       !viewingPost.likes.length && <div className="text-center text-gray-400 text-xs py-2">暂无互动</div>
                                   )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Bottom Input */}
              <div className="h-[50px] border-t border-gray-100 bg-gray-50 px-4 flex items-center gap-3 flex-shrink-0">
                  <div className="flex-1 bg-white rounded-md border border-gray-200 h-9 flex items-center px-3">
                      <input 
                        type="text" 
                        placeholder="发表评论:" 
                        className="flex-1 text-sm bg-transparent focus:outline-none"
                      />
                  </div>
                  <button className="text-gray-500 hover:text-gray-700 p-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </button>
                  <button className="text-gray-500 hover:text-gray-700 p-1">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  </button>
              </div>
          </div>
      );
  }

  // --- View: Post Editor ---
  if (isPosting) {
      return (
          <div className="flex-1 h-full bg-white flex flex-col z-50 absolute inset-0 md:static animate-in fade-in slide-in-from-bottom-4 duration-200">
              {/* Header */}
              <div className="h-[56px] flex items-center justify-between px-4 bg-white relative">
                  <button 
                    onClick={handleCancelPost} 
                    className="text-gray-900 text-[16px] font-normal hover:bg-gray-100 px-2 py-1 -ml-2 rounded transition-colors"
                  >
                      取消
                  </button>
                  <button 
                    onClick={handleSubmitPost}
                    disabled={!postText.trim() && selectedImages.length === 0}
                    className={`px-4 py-1.5 rounded-[4px] text-sm font-medium transition-colors ${
                        postText.trim() || selectedImages.length > 0 ? 'bg-[#07c160] text-white' : 'bg-[#f0f0f0] text-[#b2b2b2] cursor-not-allowed'
                    }`}
                  >
                      发表
                  </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pt-4 pb-12 custom-scrollbar">
                  <textarea 
                      className="w-full min-h-[120px] text-[16px] placeholder-gray-400 focus:outline-none resize-none leading-relaxed px-6"
                      placeholder="这一刻的想法..."
                      value={postText}
                      onChange={(e) => setPostText(e.target.value)}
                      autoFocus
                  />
                  
                  {/* Image Grid */}
                  <div className="mt-2 px-6 grid grid-cols-3 gap-2">
                      {selectedImages.map((img, idx) => (
                          <div key={idx} className="aspect-square bg-gray-100 relative overflow-hidden">
                              <img src={img} className="w-full h-full object-cover" alt={`Selected ${idx}`} />
                          </div>
                      ))}
                      
                      {selectedImages.length < 9 && (
                          <div 
                            className="aspect-square bg-[#f7f7f7] flex items-center justify-center cursor-pointer active:bg-gray-200 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                              <svg className="w-10 h-10 text-[#d1d1d1]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 4v16m8-8H4"></path>
                              </svg>
                          </div>
                      )}
                  </div>
                  <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      multiple 
                      onChange={handleImageSelect}
                  />
                  
                  {/* Options List */}
                  <div className="mt-12 border-t border-gray-100 px-6">
                      <div className="flex items-center justify-between py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50 -mx-6 px-6">
                          <div className="flex items-center gap-3">
                              <div className="w-6 flex justify-center">
                                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                              </div>
                              <span className="text-[16px] text-gray-900">所在位置</span>
                          </div>
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                      </div>
                      
                      <div className="flex items-center justify-between py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50 -mx-6 px-6">
                          <div className="flex items-center gap-3">
                              <div className="w-6 flex justify-center">
                                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"></path></svg>
                              </div>
                              <span className="text-[16px] text-gray-900">提醒谁看</span>
                          </div>
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                      </div>
                      
                      <div className="flex items-center justify-between py-4 border-b border-gray-100 cursor-pointer active:bg-gray-50 -mx-6 px-6">
                          <div className="flex items-center gap-3">
                              <div className="w-6 flex justify-center">
                                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                              </div>
                              <span className="text-[16px] text-gray-900">谁可以看</span>
                          </div>
                          <div className="flex items-center gap-1">
                              <span className="text-[16px] text-gray-500">公开</span>
                              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                          </div>
                      </div>

                      {/* AI Atmosphere Team Config */}
                      <div className="py-4 border-b border-gray-100 -mx-6 px-6">
                          <div 
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => {
                                setAiConfig(prev => ({...prev, enabled: !prev.enabled}));
                                setShowAiConfig(!showAiConfig);
                            }}
                          >
                              <div className="flex items-center gap-3">
                                  <div className="w-6 flex justify-center">
                                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                  </div>
                                  <span className="text-[16px] text-gray-900">AI 氛围组 (点赞/评论)</span>
                              </div>
                              <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out">
                                  <input 
                                    type="checkbox" 
                                    className="peer absolute w-0 h-0 opacity-0" 
                                    checked={aiConfig.enabled}
                                    readOnly
                                  />
                                  <span className={`block w-10 h-6 rounded-full shadow-inner transition-colors duration-300 ${aiConfig.enabled ? 'bg-[#07c160]' : 'bg-gray-200'}`}></span>
                                  <span className={`absolute block w-4 h-4 mt-1 ml-1 rounded-full shadow inset-y-0 left-0 focus-within:shadow-outline transition-transform duration-300 bg-white ${aiConfig.enabled ? 'transform translate-x-4' : ''}`}></span>
                              </div>
                          </div>

                          {/* Expanded Settings */}
                          {aiConfig.enabled && (
                              <div className="mt-4 pl-9 space-y-4 animate-in fade-in slide-in-from-top-2">
                                  <div>
                                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                                          <span>点赞数量 (Likes)</span>
                                          <span className="font-medium">{aiConfig.likeCount}</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="50" 
                                        value={aiConfig.likeCount} 
                                        onChange={(e) => setAiConfig(prev => ({...prev, likeCount: parseInt(e.target.value)}))}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                                      />
                                  </div>
                                  <div>
                                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                                          <span>评论数量 (Comments)</span>
                                          <span className="font-medium">{aiConfig.commentCount}</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="20" 
                                        value={aiConfig.commentCount} 
                                        onChange={(e) => setAiConfig(prev => ({...prev, commentCount: parseInt(e.target.value)}))}
                                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                                      />
                                      <p className="text-[10px] text-gray-400 mt-1">AI 将根据内容自动生成 10-20 字的评论。</p>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  // --- View: User Album (Detail Page) ---
  if (viewingUser && !viewingPost) {
      const userPosts = posts.filter(p => p.user.name === viewingUser.name);
      return (
          <div className="flex-1 h-full bg-white overflow-y-auto custom-scrollbar relative animate-in slide-in-from-right duration-200 z-40">
              {/* Nav Bar (Transparent fixed top) */}
              <div className="absolute top-0 left-0 w-full h-[60px] z-50 flex items-center px-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
                  <button 
                    onClick={() => setViewingUser(null)} 
                    className="text-white hover:bg-white/20 p-2 rounded-full transition-colors pointer-events-auto"
                  >
                      <svg className="w-6 h-6 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
              </div>

              {/* User Cover & Info */}
              <div className="relative mb-12">
                  <div className="h-[320px] w-full overflow-hidden bg-gray-800">
                       <img 
                         src={`https://picsum.photos/seed/${viewingUser.name}_album/800/600`} 
                         className="w-full h-full object-cover opacity-80" 
                         alt="Cover"
                       />
                  </div>
                  <div className="absolute bottom-[-30px] right-4 flex items-start gap-4 justify-end w-full px-4">
                       <div className="flex-1 text-right pt-2">
                           <div className="text-white font-bold text-lg drop-shadow-md mb-1">{viewingUser.name}</div>
                           <div className="text-gray-400 text-xs drop-shadow-sm">Everything is clear.</div>
                       </div>
                       <img 
                          src={viewingUser.avatar} 
                          className="w-20 h-20 rounded-xl border-2 border-white bg-gray-100 object-cover shadow-sm z-10"
                          alt="Avatar"
                       />
                  </div>
              </div>

              {/* Album Feed List */}
              <div className="max-w-2xl mx-auto px-4 pb-20 pt-8">
                  {userPosts.length === 0 ? (
                      <div className="text-center text-gray-400 text-sm py-10">暂无朋友圈内容</div>
                  ) : (
                      userPosts.map(post => (
                          <div key={post.id} className="flex gap-4 mb-8 border-b border-gray-50 pb-6 last:border-0 cursor-pointer" onClick={() => setViewingPost(post)}>
                               {/* Date Column (Simplified) */}
                               <div className="w-14 flex-shrink-0 pt-1">
                                   <div className="text-lg font-bold text-gray-900 leading-none">
                                       {/* Just using today for demo */}
                                       今天
                                   </div>
                                   <div className="text-xs text-gray-400 mt-1">
                                       {post.time}
                                   </div>
                               </div>

                               {/* Content Column */}
                               <div className="flex-1 min-w-0">
                                  {post.content && (
                                      <div className="text-[15px] text-gray-900 mb-2 leading-normal whitespace-pre-wrap">{post.content}</div>
                                  )}
                                  
                                  {/* Image Grid */}
                                  {post.images.length > 0 && (
                                      <div className={`grid gap-1.5 mb-2 ${
                                          post.images.length === 1 ? 'grid-cols-1 max-w-[200px]' : 
                                          post.images.length === 2 || post.images.length === 4 ? 'grid-cols-2 max-w-[200px]' : 
                                          'grid-cols-3 max-w-[280px]'
                                      }`}>
                                          {post.images.map((img, idx) => (
                                              <div key={idx} className={`aspect-square bg-gray-100 overflow-hidden ${post.images.length === 1 ? 'aspect-auto' : ''}`}>
                                                  <img src={img} className="w-full h-full object-cover" alt={`Img ${idx}`} />
                                              </div>
                                          ))}
                                      </div>
                                  )}
                                  
                                  {/* Interaction Bar */}
                                  <div className="flex items-center justify-between mt-3">
                                      <div className="flex gap-4">
                                          {post.likes.length > 0 && (
                                              <div className="flex items-center gap-1 text-gray-400 text-xs">
                                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                                  {post.likes.length}
                                              </div>
                                          )}
                                          {post.comments.length > 0 && (
                                              <div className="flex items-center gap-1 text-gray-400 text-xs">
                                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd"></path></svg>
                                                  {post.comments.length}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                               </div>
                          </div>
                      ))
                  )}
                  <div className="py-8 text-center text-xs text-gray-300">
                      - 个人主页 -
                  </div>
              </div>
          </div>
      );
  }

  // --- View: Main Feed ---
  return (
    <div className="flex-1 h-full bg-white overflow-y-auto custom-scrollbar relative">
      {/* Cover Header */}
      <div className="relative mb-16">
         {/* Cover Image */}
         <div className="h-[320px] w-full overflow-hidden bg-gray-200 relative group">
             <img 
               src="https://picsum.photos/seed/cover_wall/800/600" 
               alt="Cover" 
               className="w-full h-full object-cover"
             />
             
             {/* Camera Icon - Top Right */}
             <div 
                className="absolute top-4 right-4 z-20 cursor-pointer p-2 rounded-full hover:bg-black/10 transition-colors"
                onClick={() => setShowPostOptions(!showPostOptions)}
                title="发布"
             >
                 <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="rgba(0,0,0,0.2)" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-md">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                 </svg>
             </div>

             {/* Dropdown Menu */}
             {showPostOptions && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowPostOptions(false)}></div>
                    <div className="absolute top-14 right-4 bg-[#4c4c4c] text-white rounded-md shadow-lg z-40 py-1 w-32 animate-in fade-in zoom-in-95 duration-100">
                        <div 
                            className="px-4 py-3 hover:bg-[#5f5f5f] cursor-pointer text-sm border-b border-[#5f5f5f]"
                            onClick={() => {
                                setShowPostOptions(false);
                                handlePostMoment(); // Existing manual post
                            }}
                        >
                            拍摄
                        </div>
                        <div 
                            className="px-4 py-3 hover:bg-[#5f5f5f] cursor-pointer text-sm"
                            onClick={() => {
                                setShowPostOptions(false);
                                setShowAiPostModal(true);
                            }}
                        >
                            AI 自动生成
                        </div>
                    </div>
                </>
             )}
         </div>
         
         {/* User Info Overlay */}
         <div className="absolute bottom-[-30px] right-4 flex items-start gap-4 justify-end w-full px-4">
             <div className="flex-1 text-right pt-2">
                 <div className="text-white font-bold text-lg drop-shadow-md mb-1 cursor-pointer" onClick={() => setViewingUser(currentUser || { name: 'User', avatar: '' })}>{currentUser?.name || 'User'}</div>
             </div>
             
             {/* Avatar with Edit Overlay */}
             <div className="relative z-10 group">
                <img 
                   src={currentUser?.avatar || "https://picsum.photos/seed/me/100/100"} 
                   className="w-20 h-20 rounded-xl border-2 border-white bg-gray-100 object-cover shadow-sm cursor-pointer"
                   alt="Avatar"
                   onClick={() => setViewingUser(currentUser || { name: 'User', avatar: '' })}
                />
                {/* Edit Button */}
                <div 
                    className="absolute bottom-0 right-0 bg-black/60 p-1.5 rounded-br-xl rounded-tl-lg cursor-pointer hover:bg-black/80 transition-colors backdrop-blur-sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        avatarInputRef.current?.click();
                    }}
                    title="更换头像"
                >
                     <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </div>
                <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleAvatarFileChange} 
                />
             </div>
         </div>
      </div>

      {/* Feed List */}
      <div className="max-w-2xl mx-auto px-4 pb-20 pt-4">
          {posts.map(post => (
              <div key={post.id} className="flex gap-3 mb-8 border-b border-gray-50 pb-6 last:border-0">
                  <img 
                    src={post.user.avatar} 
                    className="w-10 h-10 rounded-md bg-gray-200 object-cover flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity" 
                    alt="Avatar"
                    onClick={() => setViewingUser(post.user)}
                  />
                  <div className="flex-1 min-w-0">
                      <div 
                        className="text-[#576b95] font-bold text-[15px] mb-1 leading-tight truncate cursor-pointer hover:underline"
                        onClick={() => setViewingUser(post.user)}
                      >
                          {post.user.name}
                      </div>
                      <div 
                        className="cursor-pointer"
                        onClick={() => setViewingPost(post)}
                      >
                          {post.content && (
                              <div className="text-[15px] text-gray-900 mb-2 leading-normal whitespace-pre-wrap">{post.content}</div>
                          )}
                          
                          {/* Image Grid */}
                          {post.images.length > 0 && (
                              <div className={`grid gap-1.5 mb-2 ${
                                  post.images.length === 1 ? 'grid-cols-1 max-w-[200px]' : 
                                  post.images.length === 2 || post.images.length === 4 ? 'grid-cols-2 max-w-[200px]' : 
                                  'grid-cols-3 max-w-[280px]'
                              }`}>
                                  {post.images.map((img, idx) => (
                                      <div key={idx} className={`aspect-square bg-gray-100 overflow-hidden ${post.images.length === 1 ? 'aspect-auto' : ''}`}>
                                          <img src={img} className="w-full h-full object-cover" alt={`Img ${idx}`} />
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                      
                      {/* Footer Info */}
                      <div className="flex items-center justify-between text-xs text-gray-400 mt-2 relative h-5 mb-1">
                          <span>{post.time}</span>
                          <div className="bg-[#f7f7f7] px-2 rounded-[4px] text-[#576b95] font-bold tracking-widest cursor-pointer hover:bg-gray-200 transition-colors">
                             •••
                          </div>
                      </div>

                      {/* Likes and Comments Section */}
                      {(post.likes.length > 0 || post.comments.length > 0) && (
                          <div className="bg-[#f7f7f7] rounded-[4px] mt-2 text-[14px] leading-6 p-2 relative">
                               {/* Triangle Pointer */}
                               <div className="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]"></div>

                               {/* Likes */}
                               {post.likes.length > 0 && (
                                   <div className="flex flex-wrap items-center gap-1 border-b border-gray-200/50 pb-1 mb-1">
                                       <svg className="w-3.5 h-3.5 text-[#576b95]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                       {post.likes.map((like, i) => (
                                           <span key={i} className="text-[#576b95] font-medium cursor-pointer hover:underline">
                                               {like.name}{i < post.likes.length - 1 ? '，' : ''}
                                           </span>
                                       ))}
                                   </div>
                               )}
                               
                               {/* Comments */}
                               {post.comments.map((comment, i) => (
                                   <div key={i} className="text-gray-900">
                                       <span className="text-[#576b95] font-medium cursor-pointer hover:underline">{comment.name}</span>
                                       <span className="text-gray-900">: {comment.content}</span>
                                   </div>
                               ))}
                          </div>
                      )}
                  </div>
              </div>
          ))}
          
          <div className="py-8 text-center text-xs text-gray-400 border-t border-gray-100 mt-8">
              <span className="relative px-2 bg-white">朋友仅展示最近三天的朋友圈</span>
          </div>
      </div>

      {/* AI Post Modal */}
      {showAiPostModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 shadow-2xl">
                  {/* ... (Existing AI Modal Content) ... */}
                  <div className="p-4 border-b border-gray-100">
                      <h3 className="text-lg font-medium text-gray-900">AI 自动生成朋友圈</h3>
                  </div>
                  <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">主题 / 关键词 (Topic)</label>
                          <input 
                              type="text" 
                              value={aiPostTopic}
                              onChange={(e) => setAiPostTopic(e.target.value)}
                              placeholder="e.g. 周末, 旅行, 吐槽, 随机..."
                              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                      </div>
                      
                      {/* Timeline Slider */}
                      <div>
                          <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                              <span>显示时间 (Timeline)</span>
                              <span className="text-[#07c160]">{formatTime(aiTimeValue)}</span>
                          </div>
                          <input 
                              type="range" 
                              min="0" 
                              max="180" 
                              step="1"
                              value={aiTimeValue}
                              onChange={(e) => setAiTimeValue(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                              <span>刚刚</span>
                              <span>3小时前</span>
                          </div>
                      </div>
                      
                      {/* Image Count Selection */}
                      <div>
                          <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                              <span>图片数量 (Image Count)</span>
                              <span className="text-[#07c160]">{aiImageCount} 张</span>
                          </div>
                          <input 
                              type="range" 
                              min="0" 
                              max="9" 
                              step="1"
                              value={aiImageCount}
                              onChange={(e) => setAiImageCount(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                          />
                          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                              <span>0 (纯文字)</span>
                              <span>9</span>
                          </div>
                      </div>

                      {/* Like Count Slider */}
                      <div>
                          <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                              <span>点赞数量 (AI Likes)</span>
                              <span className="text-[#07c160]">{aiLikeCount}</span>
                          </div>
                          <input 
                              type="range" 
                              min="0" 
                              max="50" 
                              step="1"
                              value={aiLikeCount}
                              onChange={(e) => setAiLikeCount(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                          />
                      </div>

                      {/* Comment Count Slider */}
                      <div>
                          <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                              <span>评论数量 (AI Comments)</span>
                              <span className="text-[#07c160]">{aiCommentCount}</span>
                          </div>
                          <input 
                              type="range" 
                              min="0" 
                              max="20" 
                              step="1"
                              value={aiCommentCount}
                              onChange={(e) => setAiCommentCount(parseInt(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#07c160]"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">AI 将根据内容自动生成 10-20 字的评论。</p>
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 flex justify-end gap-3">
                      <button 
                          onClick={() => setShowAiPostModal(false)}
                          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleGenerateAiPost}
                          disabled={isGeneratingPost}
                          className="px-4 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] disabled:opacity-50 flex items-center gap-2"
                      >
                          {isGeneratingPost && (
                              <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          )}
                          {isGeneratingPost ? '生成中...' : '生成并发布'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default MomentsView;
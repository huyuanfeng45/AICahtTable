
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, AppSettings, MomentPost, MomentLike, MomentComment } from '../types';
import { generateMomentInteractions, generateMomentPost } from '../services/geminiService';
import EmojiPicker from './EmojiPicker';

// Helper for image compression
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800; // Reduced from 1024 to 800 for better mobile stability

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            resolve(e.target?.result as string); // Fallback
            return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Compress to JPEG 0.6 (Reduced quality for storage safety)
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = (err) => resolve(e.target?.result as string); // Fallback
    };
    reader.onerror = (err) => reject(err);
  });
};

interface MomentsViewProps {
  currentUser: UserProfile | null;
  posts: MomentPost[];
  onUpdatePosts: (posts: MomentPost[]) => void;
  onUpdateUser?: (updates: Partial<UserProfile>) => void;
  settings: AppSettings;
}

const MomentsView: React.FC<MomentsViewProps> = ({ currentUser, posts, onUpdatePosts, onUpdateUser, settings }) => {
  const [isPosting, setIsPosting] = useState(false);
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState('');
  const [rawDateValue, setRawDateValue] = useState(''); // Store ISO format for input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cover Image State
  const [coverImage, setCoverImage] = useState('https://picsum.photos/seed/cover_wall/800/600');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [aiCoverPrompt, setAiCoverPrompt] = useState('');
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  // Profile Edit State
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const editAvatarInputRef = useRef<HTMLInputElement>(null);

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

  // Interaction State (Menu & Comments)
  const [activeMenuPostId, setActiveMenuPostId] = useState<number | null>(null);
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [showDetailEmoji, setShowDetailEmoji] = useState(false);

  // Intro Modal State (Persisted in Session)
  const [showIntroModal, setShowIntroModal] = useState(() => {
    try {
        return !sessionStorage.getItem('hasSeenMomentsIntro');
    } catch {
        return true;
    }
  });

  const handleCloseIntro = () => {
    setShowIntroModal(false);
    try {
        sessionStorage.setItem('hasSeenMomentsIntro', 'true');
    } catch {}
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
        if (activeMenuPostId !== null) setActiveMenuPostId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenuPostId]);

  // Focus comment input when opened
  useEffect(() => {
      if (commentingPostId !== null && commentInputRef.current) {
          commentInputRef.current.focus();
      }
  }, [commentingPostId]);

  // Load Cover Image preference
  useEffect(() => {
    if (currentUser) {
        const savedCover = localStorage.getItem(`user_cover_${currentUser.id}`);
        if (savedCover) {
            setCoverImage(savedCover);
        } else {
            setCoverImage('https://picsum.photos/seed/cover_wall/800/600');
        }
    }
  }, [currentUser]);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 15 * 1024 * 1024) {
              alert("图片大小不能超过 15MB");
              return;
          }
          
          try {
              // Apply compression to cover image as well
              const result = await compressImage(file);
              setCoverImage(result);
              if (currentUser) {
                  try {
                      localStorage.setItem(`user_cover_${currentUser.id}`, result);
                  } catch(e) {
                      console.warn("Cover image too large to save locally", e);
                  }
              }
          } catch(err) {
              console.error("Cover image processing failed", err);
              alert("图片处理失败，请重试");
          }
      }
      e.target.value = '';
  };

  const handleAiGenerateCover = async () => {
    if (!aiCoverPrompt.trim()) return;
    setIsGeneratingCover(true);
    try {
        const encodedPrompt = encodeURIComponent(aiCoverPrompt);
        // Using a landscape aspect ratio for cover
        const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1200&height=800&nologo=true&seed=${Math.random()}`;
        
        // Wait for image to load
        const img = new Image();
        img.src = url;
        img.onload = () => {
             setCoverImage(url);
             if (currentUser) {
                 localStorage.setItem(`user_cover_${currentUser.id}`, url);
             }
             setIsGeneratingCover(false);
             setShowCoverMenu(false);
             setAiCoverPrompt('');
        };
        img.onerror = () => {
            alert("生成图片失败，请重试");
            setIsGeneratingCover(false);
        };
    } catch (e) {
        console.error(e);
        setIsGeneratingCover(false);
    }
  };

  const handlePostMoment = () => {
      setIsPosting(true);
      setShowAiConfig(false);
  };

  const handleCancelPost = () => {
      setIsPosting(false);
      setPostText('');
      setSelectedImages([]);
      setCustomTime('');
      setRawDateValue('');
      setAiConfig({ enabled: false, likeCount: 5, commentCount: 3 });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setRawDateValue(val);
      if (val) {
           const date = new Date(val);
           const year = date.getFullYear();
           const month = date.getMonth() + 1;
           const day = date.getDate();
           const hour = date.getHours().toString().padStart(2, '0');
           const minute = date.getMinutes().toString().padStart(2, '0');
           setCustomTime(`${year}年${month}月${day}日 ${hour}:${minute}`);
      } else {
           setCustomTime('');
      }
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
          time: customTime || '刚刚',
          likes: [],
          comments: []
      };
      
      onUpdatePosts([newPost, ...posts]);
      
      setIsPosting(false);
      setPostText('');
      setSelectedImages([]);
      setCustomTime('');
      setRawDateValue('');
      
      if (aiConfig.enabled && (aiConfig.likeCount > 0 || aiConfig.commentCount > 0)) {
          try {
              const interactions = await generateMomentInteractions(
                  newPost.content || "Image post", 
                  aiConfig.likeCount, 
                  aiConfig.commentCount, 
                  settings
              );
              
              const enrichedLikes: MomentLike[] = interactions.likes.map(name => ({
                  name,
                  avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`
              }));
              
              const enrichedComments: MomentComment[] = interactions.comments.map(c => ({
                  ...c,
                  avatar: `https://picsum.photos/seed/${encodeURIComponent(c.name)}/200/200`,
                  time: '刚刚'
              }));

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
        
        const avatarUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(result.avatarPrompt)}?width=200&height=200&nologo=true&seed=${Math.random()}`;
        
        const imageUrls = result.imagePrompts ? result.imagePrompts.map((prompt, idx) => 
            `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=800&nologo=true&seed=${Math.random() + idx}`
        ) : [];

        const enrichedLikes: MomentLike[] = result.likes ? result.likes.map(name => ({
            name,
            avatar: `https://picsum.photos/seed/${encodeURIComponent(name)}/200/200`
        })) : [];
        
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files: File[] = Array.from(e.target.files);
      const remainingSlots = 9 - selectedImages.length;
      const filesToProcess = files.slice(0, remainingSlots);

      const processedImages: string[] = [];
      for (const file of filesToProcess) {
          try {
              const compressed = await compressImage(file);
              processedImages.push(compressed);
          } catch (err) {
              console.error("Image processing failed", err);
          }
      }

      setSelectedImages(prev => {
          if (prev.length >= 9) return prev;
          return [...prev, ...processedImages];
      });
    }
    e.target.value = ''; 
  };
  
  const handleOpenEditProfile = () => {
      setEditName(currentUser?.name || '');
      setEditAvatar(currentUser?.avatar || '');
      setShowEditProfileModal(true);
  };

  const handleEditAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              const result = await compressImage(file);
              setEditAvatar(result);
          } catch(err) {
              console.error("Avatar processing failed", err);
          }
      }
      if (e.target) e.target.value = '';
  };

  const handleSaveProfile = () => {
      if (onUpdateUser) {
          onUpdateUser({ name: editName, avatar: editAvatar });
      }
      setShowEditProfileModal(false);
  };
  
  const handleDeletePost = (postId: number) => {
      if (window.confirm('确定删除这条朋友圈吗？')) {
          onUpdatePosts(posts.filter(p => p.id !== postId));
          if (viewingPost?.id === postId) {
              setViewingPost(null);
          }
      }
  };

  // --- Interaction Logic (Like/Comment) ---

  const handleLike = (post: MomentPost) => {
      const userName = currentUser?.name || '我';
      const isLiked = post.likes.some(l => l.name === userName);
      let newLikes = [...post.likes];
      
      if (isLiked) {
          newLikes = newLikes.filter(l => l.name !== userName);
      } else {
          newLikes.push({
              name: userName,
              avatar: currentUser?.avatar || "https://picsum.photos/seed/me/100/100"
          });
      }
      
      const updatedPost = { ...post, likes: newLikes };
      const newPosts = posts.map(p => p.id === post.id ? updatedPost : p);
      onUpdatePosts(newPosts);
      
      if (viewingPost?.id === post.id) {
          setViewingPost(updatedPost);
      }
      
      setActiveMenuPostId(null);
  };

  const handleCommentClick = (postId: number) => {
      setActiveMenuPostId(null);
      // If we are in main feed, show inline input
      setCommentingPostId(postId);
      // If we are in detail view, standard input handles it
      if (viewingPost?.id === postId) {
          // Focus is handled by the detail view render which uses same state logic implicitly or we can just rely on user clicking
      }
  };

  const handleSubmitComment = (postId: number) => {
      if (!commentInput.trim()) return;
      
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      const newComment: MomentComment = {
          name: currentUser?.name || '我',
          content: commentInput.trim(),
          avatar: currentUser?.avatar || "https://picsum.photos/seed/me/100/100",
          time: '刚刚'
      };
      
      const updatedPost = { ...post, comments: [...post.comments, newComment] };
      const newPosts = posts.map(p => p.id === postId ? updatedPost : p);
      onUpdatePosts(newPosts);
      
      if (viewingPost?.id === postId) {
          setViewingPost(updatedPost);
      }
      
      setCommentingPostId(null);
      setCommentInput('');
      setShowDetailEmoji(false);
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

                          {/* Right Column: Content */}
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
                              <div className="flex items-center justify-between mt-2 mb-4 relative z-10">
                                  <div className="flex items-center gap-3 text-sm text-gray-400">
                                      <span className="text-[15px]">{viewingPost.time || '2025年11月30日 20:18'}</span>
                                      {(viewingPost.user.name === currentUser?.name || viewingPost.id > 2) && (
                                          <button 
                                              onClick={() => handleDeletePost(viewingPost.id)}
                                              className="ml-2 p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                                              title="删除"
                                          >
                                              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                          </button>
                                      )}
                                  </div>
                                  
                                  <div className="relative">
                                      {activeMenuPostId === viewingPost.id && (
                                          <div 
                                             className="absolute right-full top-1/2 -translate-y-1/2 mr-3 bg-[#4c4c4c] text-white rounded-[4px] flex items-center shadow-lg animate-in fade-in zoom-in-95 duration-200 origin-right overflow-hidden z-20"
                                             onClick={(e) => e.stopPropagation()}
                                          >
                                              <button 
                                                  onClick={() => handleLike(viewingPost)}
                                                  className="flex items-center justify-center px-4 py-2 hover:bg-[#5c5c5c] transition-colors min-w-[70px] whitespace-nowrap"
                                              >
                                                  <svg className="w-5 h-5" fill={viewingPost.likes.some(l => l.name === currentUser?.name) ? "#eb4d4b" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                      {viewingPost.likes.some(l => l.name === currentUser?.name) ? (
                                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" fill="#eb4d4b" stroke="none"></path>
                                                      ) : (
                                                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                                                      )}
                                                  </svg>
                                                  <span className="ml-1.5 text-[14px] font-medium">{viewingPost.likes.some(l => l.name === currentUser?.name) ? '取消' : '赞'}</span>
                                              </button>
                                              <div className="w-[1px] h-5 bg-[#3b3b3b]"></div>
                                              <button 
                                                  onClick={() => handleCommentClick(viewingPost.id)}
                                                  className="flex items-center justify-center px-4 py-2 hover:bg-[#5c5c5c] transition-colors min-w-[70px] whitespace-nowrap"
                                              >
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                                                  </svg>
                                                  <span className="ml-1.5 text-[14px] font-medium">评论</span>
                                              </button>
                                          </div>
                                      )}
                                      <div 
                                        className="bg-[#f7f7f7] px-2 rounded-[4px] text-[#576b95] font-bold tracking-widest cursor-pointer hover:bg-gray-200 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuPostId(activeMenuPostId === viewingPost.id ? null : viewingPost.id);
                                        }}
                                      >
                                          ••
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                      
                      {/* Interaction Section (Full Width below content) */}
                      <div className="bg-[#f7f7f7] rounded-[4px] mt-3 text-[14px] leading-6 p-2 relative">
                           {/* Triangle */}
                           <div className="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]"></div>

                           {/* Likes */}
                           {viewingPost.likes.length > 0 && (
                               <div className="flex items-start pb-2.5 border-b border-gray-200 mb-2.5">
                                   <div className="w-6 flex-shrink-0 pt-1">
                                      <svg className="w-5 h-5 text-[#576b95] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
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
                                    <div className="w-6 flex-shrink-0 pt-1">
                                        <svg className="w-5 h-5 text-[#576b95]" fill="currentColor" viewBox="0 0 24 24">
                                            <path fillRule="evenodd" d="M20 4H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 16V6h16v10H4z" clipRule="evenodd"/>
                                        </svg>
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

              {/* Bottom Input - Updated Style */}
              <div className="min-h-[60px] border-t border-gray-100 bg-[#f7f7f7] px-4 flex items-center gap-3 flex-shrink-0 relative z-20">
                  <div className="flex-1 bg-white rounded-md border border-gray-200 min-h-[40px] flex items-center px-3 py-1 my-2">
                      <input 
                        ref={commentInputRef}
                        type="text"
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        placeholder="发表评论:" 
                        className="flex-1 text-[15px] bg-transparent focus:outline-none placeholder-gray-400"
                        onKeyDown={e => {
                            if(e.key === 'Enter') handleSubmitComment(viewingPost.id);
                        }}
                      />
                  </div>
                  
                  {/* Icons */}
                  <div className="flex items-center gap-3 text-gray-800">
                      <div className="relative">
                           <button 
                              onClick={() => setShowDetailEmoji(!showDetailEmoji)}
                              className="hover:text-gray-600 transition-colors pt-1"
                           >
                              {/* Smiley Icon */}
                              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                              </svg>
                           </button>
                           {showDetailEmoji && (
                               <EmojiPicker 
                                  onSelect={(emoji) => {
                                      setCommentInput(prev => prev + emoji);
                                  }}
                                  onClose={() => setShowDetailEmoji(false)}
                                  position="right"
                               />
                           )}
                      </div>

                      <button className="hover:text-gray-600 transition-colors pt-1">
                           {/* Image Icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                          </svg>
                      </button>
                  </div>

                  {commentInput.trim() && (
                      <button 
                        onClick={() => handleSubmitComment(viewingPost.id)}
                        className="ml-1 text-white bg-[#07c160] px-3 py-1.5 rounded text-sm font-medium animate-in fade-in zoom-in duration-200"
                      >
                          发送
                      </button>
                  )}
              </div>
          </div>
      );
  }

  // --- View: Post Editor ---
  if (isPosting) {
      return (
          // Fixed positioning on mobile to ensure it sits on top and has height
          <div className="fixed inset-0 z-[100] bg-white md:static md:z-auto md:inset-auto md:flex md:flex-col md:flex-1 h-full w-full flex flex-col animate-in fade-in slide-in-from-bottom-10 duration-200">
              {/* Header */}
              <div className="h-[56px] flex items-center justify-between px-4 bg-white relative shadow-sm z-10">
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
              
              <div className="flex-1 overflow-y-auto pt-4 pb-12 custom-scrollbar bg-white">
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
                      
                      <div className="flex items-center justify-between py-4 border-b border-gray-100 -mx-6 px-6 cursor-pointer active:bg-gray-50 relative">
                          <div className="flex items-center gap-3">
                              <div className="w-6 flex justify-center">
                                  <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              </div>
                              <span className="text-[16px] text-gray-900">显示时间</span>
                          </div>
                          <div className="flex items-center gap-2 relative">
                              <span className={`text-[16px] ${customTime ? 'text-gray-900' : 'text-gray-500'}`}>
                                  {customTime || '刚刚'}
                              </span>
                              
                              {customTime ? (
                                   <button 
                                      onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setCustomTime('');
                                          setRawDateValue('');
                                      }}
                                      className="p-1 text-gray-400 hover:text-gray-600 z-10"
                                   >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                   </button>
                              ) : (
                                   <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                              )}

                              {/* Invisible Input covering the area for native picker */}
                              <input 
                                  type="datetime-local"
                                  value={rawDateValue}
                                  onChange={handleDateChange}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
                              />
                          </div>
                      </div>

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
                                        max="288" 
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

  // ... (User Album and Main Feed code remains same as before, no changes needed for this update except preserving them) ...
  // Re-pasting Main Feed for completeness of file
  return (
    <div className="flex-1 h-full bg-white overflow-y-auto custom-scrollbar relative">
      {/* Cover Header */}
      <div className="relative mb-16">
         {/* Cover Image */}
         <div 
            className="h-[320px] w-full overflow-hidden bg-gray-200 relative group cursor-pointer"
            onClick={() => setShowCoverMenu(true)}
            title="点击更换封面"
         >
             <img 
               src={coverImage} 
               alt="Cover" 
               className="w-full h-full object-cover"
             />
             
             {/* Hidden File Input for Cover */}
             <input 
                 type="file" 
                 ref={coverInputRef} 
                 className="hidden" 
                 accept="image/*" 
                 onChange={handleCoverChange}
                 onClick={(e) => e.stopPropagation()} 
             />
             
             {/* Camera Icon - Top Right (Publish) */}
             <div 
                className="absolute top-4 right-4 z-20 cursor-pointer p-2 rounded-full hover:bg-black/10 transition-colors"
                onClick={(e) => {
                    e.stopPropagation(); // Stop bubbling to cover change
                    setShowPostOptions(!showPostOptions);
                }}
                title="发布"
             >
                 <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                 </svg>
             </div>

             {/* Dropdown Menu */}
             {showPostOptions && (
                <>
                    <div className="fixed inset-0 z-30" onClick={(e) => {
                        e.stopPropagation();
                        setShowPostOptions(false);
                    }}></div>
                    <div 
                        className="absolute top-14 right-4 bg-[#4c4c4c] text-white rounded-md shadow-lg z-40 py-1 w-32 animate-in fade-in zoom-in-95 duration-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div 
                            className="px-4 py-3 hover:bg-[#5f5f5f] cursor-pointer text-sm border-b border-[#5f5f5f]"
                            onClick={() => {
                                setShowPostOptions(false);
                                handlePostMoment();
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
                 <div 
                    className="text-white font-bold text-lg drop-shadow-md mb-1 cursor-pointer hover:opacity-90" 
                    onClick={handleOpenEditProfile}
                    title="点击修改资料"
                >
                    {currentUser?.name || 'User'}
                </div>
             </div>
             
             {/* Avatar */}
             <div className="relative z-10 group">
                <img 
                   src={currentUser?.avatar || "https://picsum.photos/seed/me/100/100"} 
                   className="w-20 h-20 rounded-xl border-2 border-white bg-gray-100 object-cover shadow-sm cursor-pointer hover:opacity-95"
                   alt="Avatar"
                   onClick={handleOpenEditProfile}
                   title="点击修改资料"
                />
             </div>
         </div>
      </div>

      {/* Intro Modal (New) */}
       {showIntroModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={handleCloseIntro}>
              <div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-5 text-center border-b border-gray-100">
                      <h3 className="font-bold text-lg text-gray-900">朋友圈模拟集赞器</h3>
                  </div>
                  <div className="p-6 space-y-4 text-[15px] text-gray-700 leading-relaxed">
                      <p>1. 朋友圈 <span className="text-[#e04a4a] font-bold mx-1">仅自己可见</span>。</p>
                      <p>2. 右上角📷图标 <span className="text-[#e04a4a] font-bold mx-1">「AI 自动生成」</span> 用于丰富朋友圈用，AI生成图片约1分钟显示。</p>
                      <p>3. 自己发布内容需要打开 <span className="text-[#e04a4a] font-bold mx-1">「AI 氛围组」</span>，赞数根据需求选择。</p>
                  </div>
                  <div className="p-4 bg-gray-50 flex justify-center border-t border-gray-100">
                      <button 
                          onClick={handleCloseIntro}
                          className="w-full py-2.5 bg-[#07c160] text-white rounded-lg font-medium hover:bg-[#06ad56] transition-colors shadow-sm"
                      >
                          我知道了
                      </button>
                  </div>
              </div>
          </div>
       )}

      {/* Feed List */}
      <div className="max-w-2xl mx-auto px-4 pb-20 pt-4">
          {posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  </div>
                  <h3 className="text-gray-900 font-medium text-lg mb-2">朋友圈空空如也</h3>
                  <p className="text-gray-500 text-sm max-w-xs leading-relaxed mb-8">
                      点击封面图上的 <span className="inline-flex items-center justify-center bg-gray-100 rounded px-1.5 py-0.5 mx-1"><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></span> 图标发布动态。
                      <br/><br/>
                      💡 <b>提示：</b> 使用 <b>"AI 自动生成"</b> 功能，可以一键模拟好友们的日常动态，让这里瞬间热闹起来！
                  </p>
                  <button 
                      onClick={() => setShowAiPostModal(true)}
                      className="px-6 py-2.5 bg-[#07c160] text-white rounded-lg font-medium hover:bg-[#06ad56] transition-colors shadow-sm text-sm flex items-center gap-2"
                  >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      立即体验 AI 模拟朋友圈
                  </button>
              </div>
          ) : (
              <>
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
                            
                            {/* Footer Info & Menu */}
                            <div className="flex items-center justify-between text-xs text-gray-400 mt-2 relative h-5 mb-1 z-10">
                                <span>{post.time}</span>
                                
                                <div className="relative">
                                    {/* Interaction Menu */}
                                    {activeMenuPostId === post.id && (
                                        <div 
                                           className="absolute right-full top-1/2 -translate-y-1/2 mr-3 bg-[#4c4c4c] text-white rounded-[4px] flex items-center shadow-lg animate-in fade-in zoom-in-95 duration-200 origin-right overflow-hidden z-20"
                                           onClick={(e) => e.stopPropagation()}
                                        >
                                            <button 
                                                onClick={() => handleLike(post)}
                                                className="flex items-center justify-center px-4 py-2 hover:bg-[#5c5c5c] transition-colors min-w-[70px] whitespace-nowrap"
                                            >
                                                <svg className="w-5 h-5" fill={post.likes.some(l => l.name === currentUser?.name) ? "#eb4d4b" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                                    {post.likes.some(l => l.name === currentUser?.name) ? (
                                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" fill="#eb4d4b" stroke="none"></path>
                                                    ) : (
                                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path>
                                                    )}
                                                </svg>
                                                <span className="ml-1.5 text-[14px] font-medium">{post.likes.some(l => l.name === currentUser?.name) ? '取消' : '赞'}</span>
                                            </button>
                                            <div className="w-[1px] h-5 bg-[#3b3b3b]"></div>
                                            <button 
                                                onClick={() => handleCommentClick(post.id)}
                                                className="flex items-center justify-center px-4 py-2 hover:bg-[#5c5c5c] transition-colors min-w-[70px] whitespace-nowrap"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path>
                                                </svg>
                                                <span className="ml-1.5 text-[14px] font-medium">评论</span>
                                            </button>
                                        </div>
                                    )}
                                    
                                    <div 
                                        className="bg-[#f7f7f7] px-2 rounded-[4px] text-[#576b95] font-bold tracking-widest cursor-pointer hover:bg-gray-200 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuPostId(activeMenuPostId === post.id ? null : post.id);
                                        }}
                                    >
                                        ••
                                    </div>
                                </div>
                            </div>

                            {/* Likes and Comments Section */}
                            {(post.likes.length > 0 || post.comments.length > 0) && (
                                <div className="bg-[#f7f7f7] rounded-[4px] mt-2 text-[14px] leading-6 p-2 relative animate-in fade-in duration-200">
                                    {/* Triangle Pointer */}
                                    <div className="absolute -top-1.5 left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#f7f7f7]"></div>

                                    {/* Likes */}
                                    {post.likes.length > 0 && (
                                        <div className="flex flex-wrap items-center border-b border-gray-200/50 pb-1 mb-1 leading-5">
                                            <svg className="w-3.5 h-3.5 text-[#576b95] mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                            {post.likes.map((like, i) => (
                                                <span key={i}>
                                                    <span className="text-[#576b95] font-medium cursor-pointer hover:underline">
                                                        {like.name}
                                                    </span>
                                                    {i < post.likes.length - 1 && <span className="text-black font-sans">, </span>}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Comments */}
                                    {post.comments.map((comment, i) => (
                                        <div key={i} className="text-gray-900 leading-snug">
                                            <span className="text-[#576b95] font-medium cursor-pointer hover:underline">{comment.name}</span>
                                            <span className="text-gray-900">: {comment.content}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Inline Comment Input */}
                            {commentingPostId === post.id && (
                                <div className="mt-3 flex gap-2 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                                    <input 
                                        ref={commentInputRef}
                                        type="text" 
                                        value={commentInput}
                                        onChange={e => setCommentInput(e.target.value)}
                                        className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-green-500"
                                        placeholder="评论..."
                                        onKeyDown={e => {
                                            if(e.key === 'Enter') handleSubmitComment(post.id);
                                        }}
                                    />
                                    <button 
                                        onClick={() => handleSubmitComment(post.id)}
                                        className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                                    >
                                        发送
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </>
          )}
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
                              max="288" 
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

      {/* Edit Profile Modal, Cover Menu ... (rest remains identical) */}
      {/* Re-including these components so the file is complete */}
      {showEditProfileModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 shadow-2xl p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-6 text-center">编辑个人资料</h3>
                  
                  <div className="flex flex-col items-center mb-6">
                      <div 
                        className="relative group cursor-pointer w-20 h-20" 
                        onClick={() => editAvatarInputRef.current?.click()}
                      >
                          <img 
                              src={editAvatar || "https://picsum.photos/seed/me/100/100"} 
                              className="w-full h-full rounded-xl object-cover border border-gray-200 shadow-sm" 
                              alt="Avatar Preview"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-30 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          </div>
                      </div>
                      <input 
                          type="file" 
                          ref={editAvatarInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleEditAvatarChange} 
                      />
                      <button 
                        className="text-xs text-blue-600 mt-2 hover:underline"
                        onClick={() => editAvatarInputRef.current?.click()}
                      >
                        点击更换头像
                      </button>
                  </div>

                  <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                      <input 
                          type="text" 
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#07c160] focus:border-transparent"
                          placeholder="请输入昵称"
                      />
                  </div>

                  <div className="flex justify-end gap-3">
                      <button 
                          onClick={() => setShowEditProfileModal(false)}
                          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleSaveProfile}
                          disabled={!editName.trim()}
                          className="px-6 py-2 text-sm bg-[#07c160] text-white rounded hover:bg-[#06ad56] transition-colors shadow-sm disabled:opacity-50"
                      >
                          保存
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {showCoverMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShowCoverMenu(false)}>
            <div className="bg-white w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 text-center relative">
                    <h3 className="font-medium text-gray-900">更换封面图</h3>
                    <button 
                        onClick={() => setShowCoverMenu(false)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                
                <div className="p-6 space-y-6">
                    <button 
                        onClick={() => {
                            coverInputRef.current?.click();
                            setShowCoverMenu(false);
                        }}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all group"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-600 group-hover:text-blue-600 group-hover:scale-110 transition-all">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-gray-900">上传本地图片</div>
                                <div className="text-xs text-gray-500">从相册选择</div>
                            </div>
                        </div>
                        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>

                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-gray-100"></div>
                        <span className="flex-shrink-0 mx-4 text-xs text-gray-300">OR</span>
                        <div className="flex-grow border-t border-gray-100"></div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-100">
                        <div className="flex items-center gap-2 mb-3">
                             <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                             </div>
                             <span className="text-sm font-bold text-purple-900">AI 创意生成</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={aiCoverPrompt}
                                onChange={(e) => setAiCoverPrompt(e.target.value)}
                                placeholder="输入关键词 (如: 极光, 赛博朋克...)"
                                className="flex-1 text-sm border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleAiGenerateCover()}
                            />
                            <button 
                                onClick={handleAiGenerateCover}
                                disabled={isGeneratingCover || !aiCoverPrompt}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 font-medium shadow-sm flex items-center gap-1"
                            >
                                {isGeneratingCover ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : '生成'}
                            </button>
                        </div>
                        <p className="text-[10px] text-purple-400 mt-2">✨ 描述你想看到的画面，AI 将为你绘制独一无二的封面。</p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MomentsView;
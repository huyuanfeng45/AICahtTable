import React from 'react';
import { Favorite } from '../types';

interface FavoritesListProps {
  favorites: Favorite[];
  onSelectFavorite: (fav: Favorite) => void;
  selectedFavoriteId: string | null;
  onDeleteFavorite: (id: string, e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FavoritesList: React.FC<FavoritesListProps> = ({ 
  favorites, 
  onSelectFavorite,
  selectedFavoriteId,
  onDeleteFavorite,
  searchQuery,
  onSearchChange
}) => {
  const filteredFavorites = favorites.filter(f => 
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full md:w-[250px] h-full bg-[#f7f7f7] border-r border-[#d6d6d6] flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="p-3 bg-[#f7f7f7] pt-6 flex flex-col gap-2 border-b border-[#e5e5e5]">
        <h2 className="text-xs font-bold text-gray-500 px-1">收藏箱</h2>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
             <svg className="h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
             </svg>
          </div>
          <input 
            type="text" 
            placeholder="搜索收藏" 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#e2e2e2] text-sm text-gray-700 rounded-md pl-8 pr-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-300 placeholder-gray-500 text-xs h-[28px]"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredFavorites.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 mt-4">
                暂无收藏内容
            </div>
        ) : (
            filteredFavorites.map((fav) => (
            <div 
                key={fav.id} 
                onClick={() => onSelectFavorite(fav)}
                className={`group flex items-start p-3 cursor-pointer select-none transition-colors border-b border-gray-100 ${
                selectedFavoriteId === fav.id 
                    ? 'bg-[#c6c6c6] bg-opacity-40' 
                    : 'hover:bg-[#dcdcdc] hover:bg-opacity-50'
                }`}
            >
                {/* Icon based on type */}
                <div className={`w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center text-white text-xs font-medium mr-3 ${
                    fav.type === 'chat' ? 'bg-blue-400' : 'bg-orange-400'
                }`}>
                    {fav.type === 'chat' ? 'Chat' : 'Msg'}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="text-[13px] font-medium text-gray-900 truncate">{fav.title}</h3>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">
                            {new Date(fav.timestamp).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                        </span>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2 leading-snug">
                        {fav.preview}
                    </p>
                </div>
                
                <button 
                   onClick={(e) => onDeleteFavorite(fav.id, e)}
                   className="hidden group-hover:block p-1 text-gray-400 hover:text-red-500 transition-colors absolute right-2 top-8 bg-white/80 rounded shadow-sm"
                   title="删除"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </div>
            ))
        )}
      </div>
    </div>
  );
};

export default FavoritesList;
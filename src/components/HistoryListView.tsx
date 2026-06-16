import React, { useState } from 'react';
import { History, Heart, Trash2, BookOpen, Clock, ArrowRight, ShieldAlert } from 'lucide-react';
import { ReadingHistory, Bookmark } from '../types';

interface HistoryListViewProps {
  history: ReadingHistory[];
  bookmarks: Bookmark[];
  userLabel: string;
  userEmail: string;
  onSelectComic: (comicId: string) => void;
  onSelectChapter: (comicId: string, chapterId: string) => void;
  onClearHistory: () => void;
  onClearBookmarks: () => void;
  onRemoveBookmark: (comicId: string) => void;
}

export default function HistoryListView({
  history,
  bookmarks,
  userLabel,
  userEmail,
  onSelectComic,
  onSelectChapter,
  onClearHistory,
  onClearBookmarks,
  onRemoveBookmark,
}: HistoryListViewProps) {
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history'>('bookmarks');

  const formattedTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div id="history-list-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
      
      {/* Title */}
      <div className="mb-6">
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tighter uppercase flex items-center gap-2">
          <History className="w-8 h-8 text-rose-500" />
          <span>TỦ SÁCH CÁ NHÂN</span>
        </h1>
        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mt-1">
          Quản lý lịch sử đọc truyện và danh sách các bộ truyện theo dõi của riêng bạn.
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tài khoản đang đăng nhập</div>
            <div className="mt-1 text-lg font-black text-white">{userLabel}</div>
            <div className="mt-1 text-xs text-zinc-500">
              ID đăng nhập: <span className="font-mono text-zinc-300">{userEmail.split('@')[0] || userLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs selectors inside Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6 border-b border-zinc-800 pb-4">
        
        {/* Toggle tabs buttons */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 p-0.5 rounded">
          <button
            id="tab-btn-bookmarks"
            onClick={() => setActiveTab('bookmarks')}
            className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-black rounded transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'bookmarks'
                ? 'bg-rose-600 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>THEO DÕI ({bookmarks.length})</span>
          </button>
          
          <button
            id="tab-btn-history"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 text-[10px] uppercase tracking-widest font-black rounded transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-rose-600 text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>LỊCH SỬ ĐỌC ({history.length})</span>
          </button>
        </div>

        {/* Action Clear buttons */}
        {activeTab === 'bookmarks' && bookmarks.length > 0 && (
          <button
            id="btn-clear-bookmarks"
            onClick={onClearBookmarks}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-rose-500 flex items-center gap-1.5 transition-colors self-end sm:self-auto px-3.5 py-1.5 bg-zinc-90 w-auto bg-zinc-900 border border-zinc-850 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Huỷ mọi theo dõi</span>
          </button>
        )}

        {activeTab === 'history' && history.length > 0 && (
          <button
            id="btn-clear-history"
            onClick={onClearHistory}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-rose-500 flex items-center gap-1.5 transition-colors self-end sm:self-auto px-3.5 py-1.5 bg-zinc-900 border border-zinc-850 rounded cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xoá toàn bộ lịch sử</span>
          </button>
        )}
      </div>

      {/* Render selected TAB content */}
      <div className="relative">
        {activeTab === 'bookmarks' ? (
          bookmarks.length > 0 ? (
            <div id="bookmark-comics-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {bookmarks.map((bookmark) => {
                const proxiedImg = bookmark.comicThumbnail
                  ? `/api-image?url=${encodeURIComponent(bookmark.comicThumbnail)}`
                  : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';

                return (
                  <div
                    id={`bookmark-card-${bookmark.comicId}`}
                    key={bookmark.comicId}
                    className="group bg-zinc-900/30 hover:bg-zinc-900/70 border border-zinc-850 hover:border-rose-600/40 rounded overflow-hidden transition-all duration-300 flex flex-col h-full glow-rose cursor-pointer"
                    onClick={() => onSelectComic(bookmark.comicId)}
                  >
                    <div className="aspect-[3/4] relative bg-zinc-950 overflow-hidden border-b border-zinc-850">
                      <img
                        src={proxiedImg}
                        alt={bookmark.comicTitle}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (img.src !== bookmark.comicThumbnail) {
                            img.src = bookmark.comicThumbnail;
                          } else {
                            img.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';
                          }
                        }}
                      />
                      
                      {/* Delete Bookmark mini overlay */}
                      <button
                        id={`btn-unfollow-mini-${bookmark.comicId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBookmark(bookmark.comicId);
                        }}
                        className="absolute top-3 right-3 p-1.5 rounded bg-zinc-950/80 hover:bg-rose-600 text-zinc-300 border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Huỷ theo dõi bộ truyện này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3.5 flex flex-col flex-grow gap-1">
                      <h3 className="text-xs sm:text-sm font-black text-zinc-200 line-clamp-2 leading-tight group-hover:text-rose-500 transition-colors uppercase tracking-tight">
                        {bookmark.comicTitle}
                      </h3>
                      <span className="text-[9px] uppercase tracking-wider font-mono text-zinc-500 mt-auto font-bold">
                        ĐÃ THEO DÕI
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-zinc-900/10 rounded border border-zinc-800 p-12 text-center max-w-sm mx-auto mt-6">
              <Heart className="w-10 h-10 text-zinc-750 mx-auto mb-4" />
              <h3 className="font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1.5">Chưa theo dõi truyện nào</h3>
              <p className="text-zinc-500 text-[10px] leading-normal uppercase">
                Bấm nút <strong className="text-rose-500 font-extrabold">Theo Dõi</strong> ở trang chi tiết của bất kỳ truyện tranh nào để lưu lại tại đây.
              </p>
            </div>
          )
        ) : (
          history.length > 0 ? (
            <div id="history-items-list" className="flex flex-col gap-2.5 max-w-4xl mx-auto">
              {history.map((item) => {
                const proxiedImg = item.comicThumbnail
                  ? `/api-image?url=${encodeURIComponent(item.comicThumbnail)}`
                  : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';

                return (
                  <div
                    id={`history-item-${item.comicId}-${item.chapterId}`}
                    key={`${item.comicId}-${item.chapterId}`}
                    className="group bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-850 hover:border-rose-500/30 p-3 rounded flex items-center justify-between gap-4 transition-all pr-5 cursor-pointer"
                    onClick={() => onSelectComic(item.comicId)}
                  >
                    {/* Left: thumb and Title */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className="w-12 h-16 overflow-hidden aspect-[3/4] shrink-0 bg-zinc-950 border border-zinc-800">
                        <img
                          src={proxiedImg}
                          alt={item.comicTitle}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if (img.src !== item.comicThumbnail) {
                              img.src = item.comicThumbnail;
                            } else {
                              img.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-xs sm:text-sm text-zinc-100 group-hover:text-rose-500 truncate leading-tight transition-colors uppercase tracking-tight">
                          {item.comicTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] font-bold text-zinc-500 uppercase">
                          <span className="text-rose-500 font-black font-mono">
                            {item.chapterName.toUpperCase()}
                          </span>
                          <span className="text-zinc-650 hidden sm:inline">•</span>
                          <span className="text-zinc-500 flex items-center gap-1 font-mono text-[9px] font-black">
                            {formattedTime(item.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right action button to fast jump back to chapter reader */}
                    <button
                      id={`btn-history-read-fast-${item.comicId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectChapter(item.comicId, item.chapterId);
                      }}
                      className="px-4 py-2 border border-rose-500/25 rounded hover:bg-rose-600 hover:text-white hover:border-transparent text-[10px] font-black uppercase tracking-widest text-rose-500 shrink-0 flex items-center gap-1 cursor-pointer transition-all active:scale-95 select-none"
                    >
                      <span>Đọc tiếp</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-zinc-900/10 rounded border border-zinc-800 p-12 text-center max-w-sm mx-auto mt-6">
              <Clock className="w-10 h-10 text-zinc-750 mx-auto mb-4" />
              <h3 className="font-extrabold text-xs text-zinc-400 uppercase tracking-widest mb-1.5">Chưa đọc chương truyện nào</h3>
              <p className="text-zinc-500 text-[10px] leading-normal uppercase">
                Hãy xem qua các nội dung truyện đầy đủ và bấm đọc chương bất kỳ để lưu lịch sử.
              </p>
            </div>
          )
        )}
      </div>

    </div>
  );
}

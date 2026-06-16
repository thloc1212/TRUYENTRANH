import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Clock, Eye, Heart, List, RefreshCw, Star, Trophy, User } from 'lucide-react';
import { ComicDetail, Chapter, Bookmark, ReadingHistory } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface MangaDetailViewProps {
  comicId: string;
  onNavigateBack: () => void;
  onSelectChapter: (comicId: string, chapterId: string) => void;
  bookmarks: Bookmark[];
  onToggleBookmark: (comic: { id: string; title: string; thumbnail: string }) => void;
  readingHistory: ReadingHistory[];
}

export default function MangaDetailView({
  comicId,
  onNavigateBack,
  onSelectChapter,
  bookmarks,
  onToggleBookmark,
  readingHistory,
}: MangaDetailViewProps) {
  const [comic, setComic] = useState<ComicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false); // Default newest chapters first
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch from our local Express REST gateway proxy
  useEffect(() => {
    let active = true;
    const fetchComicDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comics-gateway/comics/${comicId}`);
        if (!response.ok) {
          throw new Error('Không thể tải thông tin truyện. Vui lòng thử lại sau.');
        }
        const data = await response.json();
        if (active) {
          setComic(data);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Có lỗi xảy ra khi fetch chi tiết sản phẩm.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchComicDetail();
    return () => {
      active = false;
    };
  }, [comicId]);

  if (loading) {
    return <LoadingSpinner message="Đang tải chi tiết truyện tranh..." />;
  }

  if (error || !comic) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="bg-zinc-900/80 p-8 rounded border border-zinc-800">
          <p className="text-rose-500 font-bold uppercase tracking-wider mb-4 leading-relaxed">{error || 'Không tìm thấy thông tin truyện tranh.'}</p>
          <button
            onClick={onNavigateBack}
            className="px-6 py-2.5 bg-rose-600 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-500 transition-all cursor-pointer"
          >
            Quay Lại Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  const isBookmarked = bookmarks.some((b) => b.comicId === comicId);
  const lastRead = readingHistory.find((h) => h.comicId === comicId);

  // Filter and sort chapters
  const filteredChapters = (comic.chapters || []).filter((ch) =>
    ch.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedChapters = [...filteredChapters].sort((a, b) => {
    return sortAsc ? a.name.localeCompare(b.name, undefined, { numeric: true }) : b.name.localeCompare(a.name, undefined, { numeric: true });
  });

  const proxiedImage = comic.thumbnail
    ? `/api-image?url=${encodeURIComponent(comic.thumbnail)}`
    : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';

  return (
    <div id={`manga-detail-view-${comicId}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
      {/* Back Button */}
      <button
        onClick={onNavigateBack}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-white mb-6 group transition-colors text-xs font-black uppercase tracking-widest cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
        <span>Quay lại trang chủ</span>
      </button>

      {/* Grid structure: Left Info Card, Right Details */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left column: Thumbnail & Bookmark Controls */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-zinc-950 p-4 rounded border border-zinc-800 relative glow-rose">
            <div className="aspect-[3/4] w-full overflow-hidden bg-zinc-900 border border-zinc-800">
              <img
                src={proxiedImage}
                alt={comic.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Author / Status summary below thumbnail */}
            <div className="mt-4 space-y-2 text-xs font-bold text-zinc-500">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="uppercase text-[10px] tracking-wider">Tác giả</span>
                <span className="text-right text-zinc-300 truncate max-w-[130px] font-sans">{comic.author || 'Đang cập nhật'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-900">
                <span className="uppercase text-[10px] tracking-wider">Trạng thái</span>
                <span className="px-1.5 py-0.5 bg-rose-600/10 text-rose-400 text-[10px] uppercase font-black tracking-widest border border-rose-500/15">
                  {comic.status || 'Đang cập nhật'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="uppercase text-[10px] tracking-wider">Lượt xem</span>
                <span className="text-zinc-300 font-mono flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-zinc-500" />
                  {comic.views || '0'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2.5">
            {/* Read First Chapter */}
            {comic.chapters && comic.chapters.length > 0 && (
              <button
                id="btn-read-first"
                onClick={() => {
                  const firstChapter = comic.chapters[comic.chapters.length - 1]; // First chapter is usually at the end of the array
                  onSelectChapter(comic.id, firstChapter.id);
                }}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest transition-all cursor-pointer text-xs"
              >
                <BookOpen className="w-4 h-4" />
                <span>Độc Từ Đầu</span>
              </button>
            )}

            {/* Continue last read chapter */}
            {lastRead && (
              <button
                id="btn-read-continue"
                onClick={() => onSelectChapter(comic.id, lastRead.chapterId)}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-rose-500 border border-rose-500/25 font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer text-xs"
              >
                <Clock className="w-4 h-4" />
                <span>Đọc Tiếp: Ch. {lastRead.chapterName.split(' ').pop()}</span>
              </button>
            )}

            {/* Toggle Bookmark button */}
            <button
              id="btn-toggle-bookmark"
              onClick={() => onToggleBookmark({ id: comic.id, title: comic.title, thumbnail: comic.thumbnail })}
              className={`w-full py-2.5 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isBookmarked
                  ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'Huỷ Theo Dõi' : 'Theo Dõi'}</span>
            </button>
          </div>

        </div>

        {/* Right column: Details, Description, Chapters List */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Main Title Metadata Card */}
          <div className="bg-zinc-900/30 p-6 rounded border border-zinc-800 flex flex-col gap-4">
            <h1 id="manga-detail-title" className="font-display font-black text-3xl sm:text-4xl text-white tracking-tighter leading-none">
              {comic.title.toUpperCase()}
            </h1>

            {/* Genres Tag Cloud */}
            {comic.genres && comic.genres.length > 0 && (
              <div id="genres-tag-cloud" className="flex flex-wrap gap-1.5 pt-1">
                {comic.genres.map((genre: any) => (
                  <span
                    key={genre.id || genre}
                    className="px-3 py-1 font-black text-[9px] uppercase tracking-wider bg-zinc-905 text-zinc-400 hover:bg-rose-600 hover:text-white border border-zinc-800 hover:border-rose-600 transition-all cursor-default"
                  >
                    {genre.name || genre}
                  </span>
                ))}
              </div>
            )}

            {/* Description Block */}
            <div className="space-y-2 mt-2">
              <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                <List className="w-3.5 h-3.5 text-rose-500" />
                <span>Nội Dung Giới Thiệu</span>
              </h3>
              <p id="manga-detail-desc" className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line bg-zinc-950/80 p-4 rounded border border-zinc-800 font-normal">
                {comic.description || 'Truyện hiện chưa có nội dung tóm tắt chi tiết.'}
              </p>
            </div>
          </div>

          {/* Chapters Panel Card */}
          <div className="bg-zinc-900/30 rounded border border-zinc-800 p-5 flex flex-col gap-4">
            
            {/* Header controls inside Chapters bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <h3 className="font-display font-black text-xl text-white tracking-tighter flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-rose-500" />
                <span>DANH SÁCH CHƯƠNG</span>
                <span className="text-[9px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400 font-mono font-bold border border-zinc-700">
                  {(comic.chapters || []).length} CHAPS
                </span>
              </h3>

              {/* Sorting Filter */}
              <button
                id="btn-toggle-sort"
                onClick={() => setSortAsc(!sortAsc)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-zinc-900 text-zinc-400 hover:text-white rounded border border-zinc-800 flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{sortAsc ? 'Cũ nhất trước' : 'Mới nhất trước'}</span>
              </button>
            </div>

            {/* Chapter Search Input */}
            <input
              id="chapter-search"
              type="text"
              placeholder="Tìm kiếm chương (ví dụ: 100)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-200 placeholder-zinc-500 pl-4 py-1.5 rounded-full border border-zinc-850 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 text-xs transition-colors"
            />

            {/* Chapters List */}
            {sortedChapters.length > 0 ? (
              <div id="chapters-list" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {sortedChapters.map((chapter) => {
                  const hasRead = lastRead?.chapterId === chapter.id;
                  return (
                    <div
                      id={`chapter-link-${chapter.id}`}
                      key={chapter.id}
                      onClick={() => onSelectChapter(comic.id, chapter.id)}
                      className={`group/item flex items-center justify-between px-3.5 py-2.5 rounded border cursor-pointer hover:border-rose-500 transition-all text-[10px] font-bold uppercase tracking-wider ${
                        hasRead
                          ? 'bg-rose-500/5 border-rose-600/30 text-rose-500'
                          : 'bg-zinc-950 border-zinc-850 hover:text-rose-500 text-zinc-400'
                      }`}
                    >
                      <span className="truncate pr-2 font-mono" title={chapter.name}>
                        {chapter.name}
                      </span>
                      {hasRead && (
                        <span className="text-[8px] uppercase tracking-widest font-black px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-sm border border-rose-500/30 shrink-0">
                          Đã xem
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 text-xs font-bold uppercase tracking-wider">
                Không tìm thấy chương nào trùng khớp.
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

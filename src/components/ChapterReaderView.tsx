import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Settings, Sliders, RefreshCw, ZoomIn, ZoomOut, AlertCircle, Maximize2, Minimize2, Check } from 'lucide-react';
import { Chapter, ChapterDetail } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ChapterReaderViewProps {
  comicId: string;
  chapterId: string;
  onNavigateToDetail: () => void;
  onSelectChapter: (comicId: string, chapterId: string) => void;
  chaptersList: Chapter[]; // List of chapters passed down for navigation
  onUpdateHistory: (historyEntry: {
    comicId: string;
    chapterId: string;
    chapterName: string;
  }) => void;
}

export default function ChapterReaderView({
  comicId,
  chapterId,
  onNavigateToDetail,
  onSelectChapter,
  chaptersList,
  onUpdateHistory,
}: ChapterReaderViewProps) {
  const [data, setData] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState<number>(100); // Percentage: 60%, 80%, 100% etc
  const [showSettings, setShowSettings] = useState(false);
  const [fullWidth, setFullWidth] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState<Record<number, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const lastReportedChapterRef = useRef<string>('');

  // Fetch chapter details via the proxy
  useEffect(() => {
    let active = true;
    const fetchChapter = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/comics-gateway/comics/${comicId}/chapters/${chapterId}`);
        if (!response.ok) {
          throw new Error('Không thể tải nội dung chương truyện. Vui lòng kiểm tra lại đường truyền.');
        }
        const result = await response.json();
        if (active) {
          setData(result);
          
          if (result.chapter_name) {
            onUpdateHistory({
              comicId,
              chapterId,
              chapterName: result.chapter_name,
            });
            lastReportedChapterRef.current = `${comicId}:${chapterId}`;
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Lỗi bất ngờ xảy ra khi tải chương truyện.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchChapter();
    return () => {
      active = false;
    };
  }, [comicId, chapterId]);

  // Scroll to top on chapter change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as any });
  }, [chapterId]);

  useEffect(() => {
    if (!data?.chapter_name) return;

    const historyKey = `${comicId}:${chapterId}`;
    if (lastReportedChapterRef.current === historyKey) return;

    onUpdateHistory({
      comicId,
      chapterId,
      chapterName: data.chapter_name,
    });
    lastReportedChapterRef.current = historyKey;
  }, [comicId, chapterId, data?.chapter_name, onUpdateHistory]);

  if (loading) {
    return <LoadingSpinner message="Đang nạp dữ liệu trang truyện, vui lòng đợi..." />;
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center animate-fade-in">
        <div className="glass-card p-8 rounded">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-4" />
          <p className="text-rose-500 font-bold uppercase tracking-wider text-xs mb-5 leading-relaxed">{error || 'Không tìm thấy trang truyện nào.'}</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={onNavigateToDetail}
              className="btn-secondary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded cursor-pointer transition-all"
            >
              Chi tiết truyện
            </button>
            <button
              onClick={() => onSelectChapter(comicId, chapterId)}
              className="btn-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded cursor-pointer transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tải lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  const getChapterOrder = (chapter: Chapter, fallbackIndex: number) => {
    const chapterNumber = chapter.name.match(/ch(?:ư|u|Æ°)ơng\s*(\d+(?:\.\d+)?)/i)
      || chapter.name.match(/^chapter\s*(\d+(?:\.\d+)?)/i)
      || chapter.name.match(/^\s*(\d+(?:\.\d+)?)/);

    if (chapterNumber) {
      return Number(chapterNumber[1]);
    }

    const idNumber = chapter.id.match(/^\d+(?:\.\d+)?$/);
    return idNumber ? Number(idNumber[0]) : fallbackIndex;
  };

  // Normalize navigation to reading order: lower chapter number -> higher chapter number.
  const orderedChapters = chaptersList
    .map((chapter, index) => ({ chapter, order: getChapterOrder(chapter, index), index }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((item) => item.chapter);
  const currentChapterIndex = orderedChapters.findIndex((ch) => ch.id === chapterId);
  const hasOlderChapter = currentChapterIndex > 0;
  const hasNewerChapter = currentChapterIndex > -1 && currentChapterIndex < orderedChapters.length - 1;

  const handleGoToNewerChapter = () => {
    if (hasNewerChapter) {
      onSelectChapter(comicId, orderedChapters[currentChapterIndex + 1].id);
    }
  };

  const handleGoToOlderChapter = () => {
    if (hasOlderChapter) {
      onSelectChapter(comicId, orderedChapters[currentChapterIndex - 1].id);
    }
  };

  const handleChapterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelectChapter(comicId, e.target.value);
  };

  // Adjust container width limits
  const maxWidthClass = fullWidth ? 'max-w-full' : 
    imageWidth === 60 ? 'max-w-2xl' :
    imageWidth === 80 ? 'max-w-4xl' : 'max-w-5xl';

  return (
    <div id={`chapter-reader-${chapterId}`} className="min-h-screen pb-16 animate-fade-in">
      
      {/* Top sticky bar */}
      <div className="glass-panel sticky top-16 z-40 w-full border-x-0 border-t-0 rounded-none">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          
          {/* Back & Title */}
          <div className="flex items-center gap-3 shrink-1 min-w-0">
            <button
              onClick={onNavigateToDetail}
              className="btn-secondary p-1.5 rounded transition-all cursor-pointer"
              title="Quay lại chi tiết"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-xs font-black uppercase tracking-tight text-zinc-300 truncate pr-2">
                {data.comic_name || 'Đọc truyện'}
              </h2>
              <p className="text-[10px] text-rose-500 font-mono tracking-widest font-black uppercase truncate">
                {data.chapter_name || 'Đang đọc'}
              </p>
            </div>
          </div>

          {/* Chapter Select / Next-Prev buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            
            {/* Prev Chapter */}
            <button
              id="reader-btn-prev"
                onClick={handleGoToOlderChapter}
                disabled={!hasOlderChapter}
              className="btn-secondary p-2 rounded disabled:opacity-30 transition-all cursor-pointer"
              title="Chương trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dropdown Selection of Chapters */}
            <select
              id="reader-chapter-dropdown"
              value={chapterId}
              onChange={handleChapterSelect}
              className="glass-control text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer max-w-[130px] sm:max-w-[200px]"
            >
              {chaptersList.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name.toUpperCase()}
                </option>
              ))}
            </select>

            {/* Next Chapter */}
            <button
              id="reader-btn-next"
              onClick={handleGoToNewerChapter}
              disabled={!hasNewerChapter}
              className="btn-primary p-2 rounded disabled:opacity-40 disabled:bg-zinc-800 transition-all cursor-pointer"
              title="Chương kế tiếp"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Settings Icon */}
          <div className="flex items-center gap-1">
            <button
              id="reader-btn-settings"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded transition-all cursor-pointer ${
                showSettings 
                  ? 'bg-rose-600/10 text-rose-500 border border-rose-500/20' 
                  : 'btn-secondary'
              }`}
              title="Cấu hình đọc truyện"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>

      {/* Settings Panel Drawer */}
      {showSettings && (
        <div id="reader-settings-drawer" className="glass-panel w-full border-x-0 border-t-0 rounded-none py-3.5 px-4 shadow-xl">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px]">
            {/* Width adjust */}
            <div className="flex items-center gap-3">
              <span className="font-black text-zinc-500 uppercase tracking-widest">CHIỀU RỘNG TRANH:</span>
              <div className="glass-control flex rounded p-0.5">
                {[60, 80, 100].map((w) => (
                  <button
                    key={w}
                    onClick={() => { setImageWidth(w); setFullWidth(false); }}
                    className={`px-3 py-1 rounded font-black transition-all ${
                      imageWidth === w && !fullWidth
                        ? 'btn-primary'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {w}%
                  </button>
                ))}
              </div>
            </div>

            {/* Stretch / Fit control */}
            <div className="flex items-center gap-3">
              <span className="font-black text-zinc-500 uppercase tracking-widest">TRÀN VIỀN:</span>
              <button
                onClick={() => setFullWidth(!fullWidth)}
                className={`p-1.5 px-3 rounded border flex items-center gap-1.5 transition-all outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer ${
                  fullWidth
                    ? 'bg-rose-600/20 text-rose-500 border-rose-500/30'
                    : 'btn-secondary'
                }`}
              >
                {fullWidth ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{fullWidth ? 'Tắt tràn' : 'Bật tràn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Pages Container */}
      <div 
        ref={containerRef}
        className={`mx-auto ${maxWidthClass} mt-4 px-2 sm:px-4 flex flex-col items-center gap-2`}
      >
        {data.images && data.images.length > 0 ? (
          data.images.map((image) => {
            const proxiedPageSrc = `/api-image?url=${encodeURIComponent(image.src)}`;
            
            return (
              <div
                id={`reader-page-wrapper-${image.page}`}
                key={image.page}
                className="w-full relative bg-zinc-950 border border-zinc-900 font-mono overflow-hidden flex flex-col items-center"
              >
                {/* Visual loading overlay for slow images */}
                {!imagesLoaded[image.page] && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-600 text-[10px] py-20 gap-2">
                    <RefreshCw className="w-5 h-5 text-zinc-700 animate-spin" />
                    <span className="uppercase tracking-widest font-black">Trang {image.page} đang tải...</span>
                  </div>
                )}

                <img
                  src={proxiedPageSrc}
                  alt={`Trang ${image.page}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className={`w-full max-h-none block object-contain transition-opacity duration-300 ${
                    imagesLoaded[image.page] ? 'opacity-100' : 'opacity-0 min-h-[400px]'
                  }`}
                  onLoad={() => {
                    setImagesLoaded(prev => ({ ...prev, [image.page]: true }));
                  }}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src !== image.src) {
                      img.src = image.src;
                    } else {
                      img.className = "hidden";
                    }
                  }}
                />

                {/* Bottom mini-hud page number */}
                <div className="absolute bottom-2 right-2 text-[9px] font-mono font-black text-rose-500 px-2 py-0.5 rounded bg-zinc-950/90 border border-zinc-800 pointer-events-none select-none">
                  TRANG {image.page}
                </div>
              </div>
            );
          })
        ) : (
          <div className="glass-card p-8 rounded w-full text-center text-zinc-400 max-w-lg mt-12">
            Không nạp được tài nguyên ảnh cho chương này. Hãy thử bấm "Tải lại" trên thanh công cụ.
          </div>
        )}
      </div>

      {/* Sticky Bottom controls */}
      <div className="w-full mt-10 max-w-md mx-auto px-4 flex items-center justify-between gap-4">
        <button
          onClick={handleGoToOlderChapter}
          disabled={!hasOlderChapter}
          className="btn-secondary flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded disabled:opacity-30 text-center cursor-pointer select-none transition-all"
        >
          {hasOlderChapter ? 'Chương Trước' : 'Hết Chương'}
        </button>
        <button
          onClick={handleGoToNewerChapter}
          disabled={!hasNewerChapter}
          className="btn-primary flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded disabled:opacity-30 disabled:bg-zinc-800 text-center cursor-pointer select-none transition-all"
        >
          {hasNewerChapter ? 'Chương Kế Tiếp' : 'Hết Truyện'}
        </button>
      </div>

    </div>
  );
}

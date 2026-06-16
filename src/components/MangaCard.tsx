import { BookOpen, Eye, Flame, ShieldAlert } from 'lucide-react';
import { Comic } from '../types';

interface MangaCardProps {
  key?: string | number;
  comic: Comic;
  onSelect: (comicId: string) => void;
  onSelectChapter?: (comicId: string, chapterId: string) => void | Promise<void>;
}

export default function MangaCard({ comic, onSelect, onSelectChapter }: MangaCardProps) {
  // Use image proxy to bypass CORS/referer restriction
  const proxiedImage = comic.thumbnail
    ? `/api-image?url=${encodeURIComponent(comic.thumbnail)}`
    : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80'; // fallback manga image

  // Extract last chapter short ID if present
  const lastChapterId = comic.last_chapter;
  const isHot = comic.views ? parseInt(comic.views.replace(/[^0-9]/g, '')) > 200000 : false;

  return (
    <div 
      id={`manga-card-${comic.id}`}
      className="group bg-zinc-950 flex flex-col h-full cursor-pointer"
      onClick={() => onSelect(comic.id)}
    >
      {/* Thumbnail Aspect Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900 border-2 border-zinc-800 group-hover:border-rose-600 transition-all duration-300">
        <img
          src={proxiedImage}
          alt={comic.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 loading-lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== comic.thumbnail) {
              img.src = comic.thumbnail;
            } else {
              img.src = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80';
            }
          }}
        />

        {/* Ambient Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/15 to-transparent z-10 pointer-events-none"></div>

        {/* Hot Badge */}
        {isHot && (
          <div className="absolute top-2.5 left-2.5 z-25 bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-md">
            HOT
          </div>
        )}

        {/* Status Badge */}
        {comic.status && (
          <div className="absolute bottom-2.5 left-2.5 z-25 bg-zinc-950/90 text-zinc-300 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border border-zinc-800">
            {comic.status}
          </div>
        )}
      </div>

      {/* Info Container */}
      <div className="py-3 flex flex-col flex-1 gap-1">
        <h3 
          id={`manga-card-title-${comic.id}`}
          className="font-black text-sm uppercase tracking-tight line-clamp-1 text-zinc-100 group-hover:text-rose-500 transition-colors leading-none"
          title={comic.title}
        >
          {comic.title}
        </h3>

        {/* Dynamic details */}
        <div className="mt-1 flex items-center justify-between gap-2 text-xs font-bold text-zinc-500">
          {comic.views ? (
            <span className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-wider">
              <Eye className="w-3 h-3 text-zinc-600" />
              <span>{comic.views}</span>
            </span>
          ) : (
            <span className="text-[10px] uppercase font-mono tracking-wider text-rose-500/80">VN-PRO</span>
          )}

          {/* Last chapter quick button */}
          {lastChapterId ? (
            <button
              id={`manga-card-btn-${comic.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectChapter) {
                  onSelectChapter(comic.id, lastChapterId);
                } else {
                  onSelect(comic.id);
                }
              }}
              className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all text-[10px] font-black text-zinc-300 uppercase tracking-wider cursor-pointer"
            >
              CH. {lastChapterId.split('-').pop() || lastChapterId}
            </button>
          ) : comic.chapters_count ? (
            <span className="text-[9px] font-black bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-800 uppercase tracking-wilder">
              {comic.chapters_count} CHAPS
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

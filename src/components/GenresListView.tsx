import React, { useState, useEffect } from 'react';
import { Compass, BookOpen, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Genre, Comic } from '../types';
import MangaCard from './MangaCard';
import LoadingSpinner from './LoadingSpinner';

interface GenresListViewProps {
  onSelectComic: (id: string) => void;
  onSelectChapter?: (comicId: string, chapterId: string) => void;
}

export default function GenresListView({ onSelectComic, onSelectChapter }: GenresListViewProps) {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('');
  const [comics, setComics] = useState<Comic[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingGenres, setLoadingGenres] = useState(true);
  const [loadingComics, setLoadingComics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all genres first
  useEffect(() => {
    let active = true;
    const fetchGenres = async () => {
      setLoadingGenres(true);
      setError(null);
      try {
        const response = await fetch('/api/comics-gateway/genres');
        if (!response.ok) {
          throw new Error('Không thể nạp danh sách thể loại.');
        }
        const data = await response.json();
        if (active) {
          setGenres(data);
          if (data.length > 0) {
            setSelectedGenreId(data[0].id);
          }
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'Lỗi nạp thể loại.');
        }
      } finally {
        if (active) {
          setLoadingGenres(false);
        }
      }
    };
    fetchGenres();
    return () => {
      active = false;
    };
  }, []);

  // Fetch comics in the selected genre when selectedGenreId or page changes
  useEffect(() => {
    if (!selectedGenreId) return;

    let active = true;
    const fetchGenreComics = async () => {
      setLoadingComics(true);
      try {
        const response = await fetch(`/api/comics-gateway/genres/${selectedGenreId}?page=${page}`);
        if (!response.ok) {
          throw new Error('Không thể tải truyện trong thể loại này.');
        }
        const data = await response.json();
        if (active) {
          // If the page doesn't have comics or length < 20, let's assume limit is reached
          // The popular NetTruyen API has structured lists inside `comics`
          const fetchedComics = data.comics || data || [];
          setComics(fetchedComics);
          setHasMore(fetchedComics.length >= 10); // Adjust hasMore limit based on results
        }
      } catch (err) {
        if (active) {
          setComics([]);
          setHasMore(false);
        }
      } finally {
        if (active) {
          setLoadingComics(false);
        }
      }
    };

    fetchGenreComics();
    return () => {
      active = false;
    };
  }, [selectedGenreId, page]);

  const handleGenreClick = (genreId: string) => {
    setSelectedGenreId(genreId);
    setPage(1); // Reset page to 1
  };

  const handleNextPage = () => {
    if (hasMore) {
      setPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loadingGenres) {
    return <LoadingSpinner message="Đang nạp danh sách thể loại..." />;
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center animate-fade-in">
        <div className="bg-zinc-900/90 p-8 rounded border border-zinc-800">
          <p className="text-rose-500 font-bold uppercase tracking-wider text-xs mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-rose-600 text-xs font-black uppercase tracking-widest text-white hover:bg-rose-500 transition-all cursor-pointer"
          >
            Tải Lại Trang
          </button>
        </div>
      </div>
    );
  }

  const activeGenreDescription = genres.find((g) => g.id === selectedGenreId)?.description;

  return (
    <div id="genres-list-view" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
      
      {/* Title */}
      <div className="mb-6">
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tighter uppercase flex items-center gap-2">
          <Compass className="w-8 h-8 text-rose-500" />
          <span>KHÁM PHÁ THEO THỂ LOẠI</span>
        </h1>
        <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mt-1">
          Lọc truyện tranh theo nội dung và chủ đề mà bạn yêu thích.
        </p>
      </div>

      {/* Genres Buttons Container */}
      <div className="bg-zinc-900/30 border border-zinc-800 p-4 rounded mb-8">
        <div id="genres-button-hub" className="flex flex-wrap gap-2 max-h-[148px] overflow-y-auto pr-1">
          {genres.map((genre) => {
            const isSelected = genre.id === selectedGenreId;
            return (
              <button
                id={`genre-btn-${genre.id}`}
                key={genre.id}
                onClick={() => handleGenreClick(genre.id)}
                className={`px-3 py-1.5 rounded text-[10px] uppercase tracking-wider font-extrabold border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-850 hover:text-white hover:bg-zinc-900'
                }`}
                title={genre.description || genre.name}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
        
        {/* Active Genre description overlay */}
        {activeGenreDescription && (
          <div id="active-genre-details" className="mt-3.5 pt-3.5 border-t border-zinc-800 text-xs text-zinc-400 leading-relaxed">
            <strong className="text-rose-500 font-black uppercase text-[9px] tracking-widest mr-1.5">MÔ TẢ THỂ LOẠI:</strong> <span className="font-medium italic">{activeGenreDescription}</span>
          </div>
        )}
      </div>

      {/* Comics output list */}
      <div className="relative">
        {loadingComics ? (
          <LoadingSpinner message="Đang tải danh sách truyện tranh theo thể loại..." />
        ) : comics.length > 0 ? (
          <div className="space-y-8">
            <div id="genre-comics-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {comics.map((comic) => (
                <MangaCard 
                  key={comic.id} 
                  comic={comic} 
                  onSelect={onSelectComic}
                  onSelectChapter={onSelectChapter}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <div id="genre-pagination" className="flex items-center justify-center gap-4 pt-6 border-t border-zinc-800">
              <button
                id="genre-page-prev"
                onClick={handlePrevPage}
                disabled={page === 1}
                className="p-2.5 px-4 rounded font-black bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 border border-zinc-800 transition-colors text-xs text-zinc-300 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>TRANG TRƯỚC</span>
              </button>
              
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                TRANG <span className="text-rose-500 font-mono font-black text-sm">{page}</span>
              </span>

              <button
                id="genre-page-next"
                onClick={handleNextPage}
                disabled={!hasMore}
                className="p-2.5 px-4 rounded font-black bg-zinc-900 hover:bg-zinc-850 disabled:opacity-40 border border-zinc-800 transition-colors text-xs text-zinc-300 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
              >
                <span>TRANG KẾ</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-zinc-500 text-xs font-bold uppercase tracking-widest leading-relaxed">
            Hiện chưa có bộ truyện nào thuộc thể loại này trong trang này.
          </div>
        )}
      </div>

    </div>
  );
}

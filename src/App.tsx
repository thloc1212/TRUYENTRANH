import React, { useState, useEffect } from 'react';
import { Compass, Clock, BookOpen, Search, Sparkles, ChevronLeft, ChevronRight, X, Heart, Flame, Shield, Layout, AlertCircle } from 'lucide-react';
import { Comic, Bookmark, ReadingHistory, Chapter } from './types';
import Header from './components/Header';
import MangaCard from './components/MangaCard';
import MangaDetailView from './components/MangaDetailView';
import ChapterReaderView from './components/ChapterReaderView';
import GenresListView from './components/GenresListView';
import HistoryListView from './components/HistoryListView';
import LoadingSpinner from './components/LoadingSpinner';
import { useFirebaseSync } from './hooks/useFirebaseSync';

type AppRoute = 'source' | 'manga-detail' | 'chapter-reader' | 'genres' | 'history';
type SourceTab = 'recent' | 'trending' | 'new' | 'completed';
type AppTheme = 'dark' | 'light';

const SOURCE_ROUTE_MAP: Record<SourceTab, string> = {
  recent: '/truyen-moi',
  trending: '/dang-cap-nhat',
  new: '/moi-nhat',
  completed: '/hoan-thanh',
};

const SOURCE_ROUTE_LOOKUP: Record<string, SourceTab> = {
  '/': 'recent',
  '/truyen-moi': 'recent',
  '/dang-cap-nhat': 'trending',
  '/moi-nhat': 'new',
  '/hoan-thanh': 'completed',
};

const DETAIL_ROUTE_PATTERN = /^\/truyen\/([^/]+)$/;
const CHAPTER_ROUTE_PATTERN = /^\/truyen\/([^/]+)\/chuong\/([^/]+)$/;

function getRouteState(pathname: string) {
  const chapterMatch = pathname.match(CHAPTER_ROUTE_PATTERN);
  if (chapterMatch) {
    return {
      currentView: 'chapter-reader' as AppRoute,
      selectedComicId: chapterMatch[1],
      selectedChapterId: chapterMatch[2],
      homeTab: 'recent' as SourceTab,
    };
  }

  const detailMatch = pathname.match(DETAIL_ROUTE_PATTERN);
  if (detailMatch) {
    return {
      currentView: 'manga-detail' as AppRoute,
      selectedComicId: detailMatch[1],
      selectedChapterId: '',
      homeTab: 'recent' as SourceTab,
    };
  }

  if (pathname === '/genres') {
    return {
      currentView: 'genres' as AppRoute,
      selectedComicId: '',
      selectedChapterId: '',
      homeTab: 'recent' as SourceTab,
    };
  }

  if (pathname === '/history') {
    return {
      currentView: 'history' as AppRoute,
      selectedComicId: '',
      selectedChapterId: '',
      homeTab: 'recent' as SourceTab,
    };
  }

  return {
    currentView: 'source' as AppRoute,
    selectedComicId: '',
    selectedChapterId: '',
    homeTab: SOURCE_ROUTE_LOOKUP[pathname] || 'recent',
  };
}

function getSourcePath(tab: SourceTab) {
  return SOURCE_ROUTE_MAP[tab] || '/truyen-moi';
}

export default function App() {
  const {
    user,
    signInWithCredentials,
    registerWithCredentials,
    signOut,
    bookmarks,
    readingHistory,
    toggleBookmark,
    removeBookmark,
    updateHistory,
    clearBookmarks,
    clearHistory,
  } = useFirebaseSync();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUserId, setAuthUserId] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [theme, setTheme] = useState<AppTheme>(() => {
    const savedTheme = window.localStorage.getItem('app-theme');
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  });

  const initialRoute = getRouteState(window.location.pathname);

  // Navigation & Slices
  const [currentView, setCurrentView] = useState<AppRoute>(initialRoute.currentView);
  const [selectedComicId, setSelectedComicId] = useState<string>(initialRoute.selectedComicId);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(initialRoute.selectedChapterId);
  
  // Search inputs
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState('');

  // Core Data Lists
  const [comicsList, setComicsList] = useState<Comic[]>([]);
  const [homeTab, setHomeTab] = useState<SourceTab>(initialRoute.homeTab);
  const [homePage, setHomePage] = useState<number>(1);
  const [hasMoreHome, setHasMoreHome] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  
  // Active Chapter detail states
  const [activeChaptersList, setActiveChaptersList] = useState<Chapter[]>([]);

  // Hero highlights (picked from trending)
  const [heroComics, setHeroComics] = useState<Comic[]>([]);

  useEffect(() => {
    window.localStorage.setItem('app-theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  };

  // Fetch home / tab comics when homeTab, homePage, or submittedSearchQuery shifts
  useEffect(() => {
    if (currentView !== 'source') return;

    let active = true;
    const fetchHomeComics = async () => {
      setLoading(true);
      try {
        let endpointUrl = `/api/comics-gateway/comics/recent?page=${homePage}`;
        
        if (submittedSearchQuery) {
          endpointUrl = `/api/comics-gateway/comics/search?q=${encodeURIComponent(submittedSearchQuery)}&page=${homePage}`;
        } else {
          switch (homeTab) {
            case 'trending':
              endpointUrl = `/api/comics-gateway/comics/trending?page=${homePage}`;
              break;
            case 'new':
              endpointUrl = `/api/comics-gateway/comics/new?page=${homePage}`;
              break;
            case 'completed':
              endpointUrl = `/api/comics-gateway/comics/completed?page=${homePage}`;
              break;
            default:
              endpointUrl = `/api/comics-gateway/comics/recent?page=${homePage}`;
          }
        }

        const response = await fetch(endpointUrl);
        if (!response.ok) {
          throw new Error('API request failed');
        }
        const data = await response.json();
        
        if (active) {
          // Normal list returns { comics, total_pages, current_page } or direct array
          const items = data.comics || data || [];
          setComicsList(items);
          setHasMoreHome(items.length >= 10);

          // Seed hero banner once if tab is trending and we don't have hero yet
          if (homeTab === 'trending' && heroComics.length === 0 && items.length > 0) {
            setHeroComics(items.slice(0, 3));
          }
        }
      } catch (err) {
        if (active) {
          setComicsList([]);
          setHasMoreHome(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchHomeComics();
    return () => {
      active = false;
    };
  }, [currentView, homeTab, homePage, submittedSearchQuery]);

  // Seed initial hero banner on cold start
  useEffect(() => {
    const seedBanner = async () => {
      try {
        const response = await fetch('/api/comics-gateway/comics/trending?page=1');
        if (response.ok) {
          const data = await response.json();
          const items = data.comics || data || [];
          if (items.length > 0) {
            setHeroComics(items.slice(0, 3));
          }
        }
      } catch (e) {
        console.error('Failed to seed hero banner:', e);
      }
    };
    seedBanner();
  }, []);

  // Shared Navigation function
  const handleNavigate = (view: AppRoute, params: any = {}) => {
    const isSourceView = view === 'source';

    if (!isSourceView) {
      setSearchQuery('');
      setSubmittedSearchQuery('');
    }

    if (view === 'source') {
      const nextTab = (params.tab as SourceTab) || homeTab;
      setCurrentView('source');
      setSelectedComicId('');
      setSelectedChapterId('');
      setHomeTab(nextTab);
      setHomePage(1);
      window.history.pushState({}, '', getSourcePath(nextTab));
      return;
    }

    if (view === 'genres') {
      setCurrentView('genres');
      setSelectedComicId('');
      setSelectedChapterId('');
      window.history.pushState({}, '', '/genres');
      return;
    }

    if (view === 'history') {
      setCurrentView('history');
      setSelectedComicId('');
      setSelectedChapterId('');
      window.history.pushState({}, '', '/history');
      return;
    }

    if (params.comicId) {
      setSelectedComicId(params.comicId);
    }
    if (params.chapterId) {
      setSelectedChapterId(params.chapterId);
    }

    setCurrentView(view);
    if (view === 'manga-detail' && params.comicId) {
      window.history.pushState({}, '', `/truyen/${params.comicId}`);
    }
    if (view === 'chapter-reader' && params.comicId && params.chapterId) {
      window.history.pushState({}, '', `/truyen/${params.comicId}/chuong/${params.chapterId}`);
    }
  };

  useEffect(() => {
    const syncRouteFromLocation = () => {
      const routeState = getRouteState(window.location.pathname);
      setCurrentView(routeState.currentView);
      setSelectedComicId(routeState.selectedComicId);
      setSelectedChapterId(routeState.selectedChapterId);
      setHomeTab(routeState.homeTab);
      setHomePage(1);
      setSearchQuery('');
      setSubmittedSearchQuery('');
    };

    window.addEventListener('popstate', syncRouteFromLocation);
    return () => window.removeEventListener('popstate', syncRouteFromLocation);
  }, []);

  // Search callbacks
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSubmittedSearchQuery(searchQuery.trim());
      setHomePage(1); // Reset page when fetching search results
      setCurrentView('source');
      window.history.pushState({}, '', getSourcePath(homeTab));
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSubmittedSearchQuery('');
    setHomePage(1);
  };

  // Bookmarks handlers
  const handleToggleBookmark = (comic: { id: string; title: string; thumbnail: string }) => {
    toggleBookmark(comic);
  };

  const handleClearBookmarks = () => {
    if (window.confirm('Bạn có chắc chắn muốn huỷ tất cả truyện đang theo dõi khỏi Tủ sách?')) {
      clearBookmarks();
    }
  };

  const handleRemoveBookmark = (comicId: string) => {
    removeBookmark(comicId);
  };

  // History handlers
  const handleUpdateHistory = (historyEntry: {
    comicId: string;
    chapterId: string;
    chapterName: string;
  }) => {
    let comicTitle = 'Truyện Tranh';
    let comicThumbnail = '';

    const fetchAndSaveHistory = async () => {
      try {
        const matchBook = bookmarks.find((b) => b.comicId === historyEntry.comicId);
        if (matchBook) {
          comicTitle = matchBook.comicTitle;
          comicThumbnail = matchBook.comicThumbnail;
        } else {
          const res = await fetch(`/api/comics-gateway/comics/${historyEntry.comicId}`);
          if (res.ok) {
            const detail = await res.json();
            comicTitle = detail.title || comicTitle;
            comicThumbnail = detail.thumbnail || comicThumbnail;
          }
        }
      } catch {
        // ignore errors
      } finally {
        updateHistory({
          comicId: historyEntry.comicId,
          comicTitle,
          comicThumbnail,
          chapterId: historyEntry.chapterId,
          chapterName: historyEntry.chapterName
        });
      }
    };

    fetchAndSaveHistory();
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xoá toàn bộ lịch sử đọc truyện?')) {
      clearHistory();
    }
  };

  // Callback helper for selecting a chapter (fetches list of sister chapters first for paginations)
  const handleSelectChapter = async (comicId: string, chapterId: string) => {
    try {
      // Pre-set list of chapters by fetching details first
      const res = await fetch(`/api/comics-gateway/comics/${comicId}`);
      if (res.ok) {
        const detail = await res.json();
        if (detail.chapters) {
          setActiveChaptersList(detail.chapters);
        }
      }
    } catch (e) {
      console.error('Failed to pre-fetch chapters list:', e);
    }

    handleNavigate('chapter-reader', { comicId, chapterId });
  };

  // Home Pagination
  const handleNextPageHome = () => {
    if (hasMoreHome) {
      setHomePage((prev) => prev + 1);
      window.scrollTo({ top: 380, behavior: 'smooth' }); // Scroll to feed start
    }
  };

  const handlePrevPageHome = () => {
    if (homePage > 1) {
      setHomePage((prev) => prev - 1);
      window.scrollTo({ top: 380, behavior: 'smooth' });
    }
  };

  const handleTabChange = (tab: 'recent' | 'trending' | 'new' | 'completed') => {
    setHomeTab(tab);
    setHomePage(1); // Reset page to 1
    setSubmittedSearchQuery(''); // Clear search when tab changes
    setCurrentView('source');
    window.history.pushState({}, '', getSourcePath(tab));
  };

  const openAuthModal = () => {
    setAuthError('');
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    if (authSubmitting) return;
    setAuthModalOpen(false);
    setAuthError('');
  };

  const submitAuthForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUserId = authUserId.trim().toLowerCase();

    if (!normalizedUserId || !authPassword.trim()) {
      setAuthError('Vui lòng nhập cả ID và mật khẩu.');
      return;
    }

    setAuthSubmitting(true);
    setAuthError('');

    try {
      if (authMode === 'register') {
        await registerWithCredentials(normalizedUserId, authPassword);
      } else {
        await signInWithCredentials(normalizedUserId, authPassword);
      }

      setAuthModalOpen(false);
      setAuthPassword('');
    } catch (error) {
      const firebaseCode = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : '';
      if (firebaseCode === 'auth/operation-not-allowed') {
        setAuthError('Firebase Auth đang tắt phương thức Email/Password. Hãy bật Email/Password trong Firebase Console > Authentication > Sign-in method.');
      } else if (firebaseCode === 'auth/user-not-found') {
        setAuthError('ID này chưa có tài khoản. Hãy chuyển sang Tạo tài khoản.');
      } else if (firebaseCode === 'auth/wrong-password' || firebaseCode === 'auth/invalid-credential') {
        setAuthError('Sai ID hoặc mật khẩu.');
      } else if (firebaseCode === 'auth/email-already-in-use') {
        setAuthError('ID này đã tồn tại. Hãy đăng nhập hoặc dùng ID khác.');
      } else {
        const message = error instanceof Error ? error.message : 'Không thể xác thực tài khoản.';
        setAuthError(message);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  return (
    <div data-theme={theme} className="app-shell min-h-screen flex flex-col font-sans leading-normal antialiased">
      
      {/* Dynamic Navigation Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        user={user}
        onOpenAuth={openAuthModal}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Main Container wrapper */}
      <main id="main-content" className="flex-grow">
        
        {/* Render Views dynamically */}
        {currentView === 'source' && (
          <div id="home-view-container" className="pb-16 animate-fade-in">
            
            {/* 1. Hero Highlights Carousel (When not in search mode) */}
            {!submittedSearchQuery && heroComics.length > 0 && homePage === 1 && (
              <div id="hero-slider" className="glass-panel relative border-x-0 border-t-0 rounded-none py-8 sm:py-12 overflow-hidden">
                {/* Background ambient blurring */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-rose-900/10 via-transparent to-transparent pointer-events-none select-none"></div>
                
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></div>
                    <h2 className="text-[10px] uppercase tracking-[0.2em] text-rose-500 font-bold font-mono">ĐỀ CỬ NỔI BẬT HÔM NAY</h2>
                  </div>

                  {/* Desktop layout: 3 highlighted columns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {heroComics.map((hero) => {
                      const proxiedImg = hero.thumbnail
                        ? `/api-image?url=${encodeURIComponent(hero.thumbnail)}`
                        : '';
                      return (
                        <div
                          id={`hero-card-${hero.id}`}
                          key={hero.id}
                          onClick={() => handleNavigate('manga-detail', { comicId: hero.id })}
                          className="glass-card group relative flex p-4 rounded-xl hover:border-rose-600 cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                        >
                          {/* Image side */}
                          <div className="w-20 sm:w-24 aspect-[3/4] rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-zinc-800 group-hover:border-rose-500 transition-colors">
                            <img
                              src={proxiedImg}
                              alt={hero.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            />
                          </div>
                          {/* Detail summary side */}
                          <div className="ml-4 flex flex-col justify-between py-1 min-w-0 flex-1">
                            <div>
                              <h3 className="font-black text-sm uppercase tracking-tight text-zinc-100 group-hover:text-rose-500 transition-colors line-clamp-2 leading-tight">
                                {hero.title}
                              </h3>
                              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mt-1 line-clamp-2">
                                {hero.status || 'Đang tiến hành'}
                              </p>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono mt-2">
                              <span>{hero.views || 'Hot'} views</span>
                              <span className="px-2 py-0.5 bg-rose-600/10 text-rose-400 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest rounded-sm">
                                CẬP NHẬT
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Search / Tab header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
              {submittedSearchQuery ? (
                <div id="search-indicators" className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-5 mb-8">
                  <div>
                    <h2 className="font-display font-black text-xl sm:text-2xl text-white">
                      KẾT QUẢ TÌM KIẾM CHO: "<span className="text-rose-500">{submittedSearchQuery.toUpperCase()}</span>"
                    </h2>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 mt-1">
                      Tìm thấy {(comicsList || []).length} kết quả phù hợp.
                    </p>
                  </div>
                  <button
                    id="btn-clear-search-view"
                    onClick={clearSearch}
                    className="btn-secondary p-1 px-3 text-[10px] font-black uppercase tracking-widest rounded transition-all cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Xoá tìm kiếm</span>
                  </button>
                </div>
              ) : (
                /* Tab Switcher on home page */
                <div id="home-tabs-bar" className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4 mb-8">
                  
                  {/* Sorting segments */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'recent', label: 'Mới Cập Nhật', desc: 'Truyện cập nhật chương mới' },
                      { id: 'trending', label: 'Xu Hướng', desc: 'Truyện nổi bật nhất hôm nay' },
                      { id: 'new', label: 'Mới Nhất', desc: 'Truyện tranh mới đăng tải' },
                      { id: 'completed', label: 'Trọn Bộ', desc: 'Truyện tranh đã hoàn thành' },
                    ].map((tab) => (
                      <button
                        id={`home-tab-btn-${tab.id}`}
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id as any)}
                        className={`px-4 py-2 font-black text-xs uppercase tracking-widest transition-all cursor-pointer ${
                          homeTab === tab.id
                            ? 'btn-primary'
                            : 'btn-secondary'
                        }`}
                        title={tab.desc}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Active view title */}
                  <div className="hidden lg:flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                    <Flame className="w-4 h-4 text-rose-500 fill-current animate-pulse" />
                    <span>TLDepTrai</span>
                  </div>
                </div>
              )}

              {/* Feed Grid mapping */}
              {loading ? (
                <LoadingSpinner message="Đang nạp danh sách truyện tranh..." />
              ) : comicsList.length > 0 ? (
                <div className="space-y-8">
                  <div id="home-comics-grid" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {comicsList.map((comic) => (
                      <MangaCard
                        key={comic.id}
                        comic={comic}
                        onSelect={(id) => handleNavigate('manga-detail', { comicId: id })}
                        onSelectChapter={handleSelectChapter}
                      />
                    ))}
                  </div>

                  {/* Home Feed Pagination */}
                  <div id="home-pagination-controls" className="flex items-center justify-center gap-4 pt-6 mt-8 border-t border-zinc-800">
                    <button
                      id="home-page-prev"
                      onClick={handlePrevPageHome}
                      disabled={homePage === 1}
                      className="btn-secondary p-2.5 px-4 rounded font-black disabled:opacity-40 text-xs flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>TRANG TRƯỚC</span>
                    </button>
                    
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                      TRANG <span className="font-display font-black text-rose-500 text-sm font-mono">{homePage}</span>
                    </span>

                    <button
                      id="home-page-next"
                      onClick={handleNextPageHome}
                      disabled={!hasMoreHome}
                      className="btn-secondary p-2.5 px-4 rounded font-black disabled:opacity-40 text-xs flex items-center gap-1 cursor-pointer transition-all uppercase tracking-wider"
                    >
                      <span>TRANG KẾ</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="glass-card text-center py-20 rounded">
                  <AlertCircle className="w-10 h-10 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-400 font-bold text-xs uppercase tracking-wider">Không tìm thấy truyện tranh nào phù hợp.</p>
                  <button
                    onClick={clearSearch}
                    className="btn-primary mt-5 px-6 py-2 font-black text-xs uppercase tracking-widest rounded cursor-pointer transition-all"
                  >
                    Xem tất cả truyện
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Comic Detail View */}
        {currentView === 'manga-detail' && (
          <MangaDetailView
            comicId={selectedComicId}
            onNavigateBack={() => handleNavigate('source', { tab: homeTab })}
            onSelectChapter={handleSelectChapter}
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
            readingHistory={readingHistory}
          />
        )}

        {/* Chapter Reader Panel */}
        {currentView === 'chapter-reader' && (
          <ChapterReaderView
            comicId={selectedComicId}
            chapterId={selectedChapterId}
            onNavigateToDetail={() => handleNavigate('manga-detail', { comicId: selectedComicId })}
            onSelectChapter={(cid, chid) => handleNavigate('chapter-reader', { comicId: cid, chapterId: chid })}
            chaptersList={activeChaptersList}
            onUpdateHistory={handleUpdateHistory}
          />
        )}

        {/* Explore Genres View */}
        {currentView === 'genres' && (
          <GenresListView
            onSelectComic={(id) => handleNavigate('manga-detail', { comicId: id })}
            onSelectChapter={handleSelectChapter}
          />
        )}

        {/* Personal Bookmarks/History View */}
        {currentView === 'history' && (
          <HistoryListView
            history={readingHistory}
            bookmarks={bookmarks}
            userLabel={user?.displayName || user?.email?.split('@')[0] || 'Bạn đọc'}
            userEmail={user?.email || ''}
            onSelectComic={(id) => handleNavigate('manga-detail', { comicId: id })}
            onSelectChapter={handleSelectChapter}
            onClearHistory={handleClearHistory}
            onClearBookmarks={handleClearBookmarks}
            onRemoveBookmark={handleRemoveBookmark}
          />
        )}

      </main>

      {authModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    {authMode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
                  </h2>
                  <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
                    Chỉ cần ID và mật khẩu, không cần Gmail.
                  </p>
                </div>
                <button
                  onClick={closeAuthModal}
                  className="glass-control rounded-full p-2 transition-colors"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={submitAuthForm} className="p-6 space-y-4">
              <div className="glass-control flex rounded-full p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                    authMode === 'login' ? 'btn-primary' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                    authMode === 'register' ? 'btn-primary' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Tạo tài khoản
                </button>
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">ID tài khoản</span>
                <input
                  value={authUserId}
                  onChange={(e) => setAuthUserId(e.target.value)}
                  placeholder="vd: user123"
                  autoComplete="username"
                  className="glass-control w-full rounded-xl px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-600"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Mật khẩu</span>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  className="glass-control w-full rounded-xl px-4 py-3 text-sm outline-none placeholder:text-zinc-600 focus:border-rose-600"
                />
              </label>

              {authError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-300">
                  {authError}
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="btn-primary w-full rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authSubmitting ? 'Đang xử lý...' : authMode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
              </button>

              <p className="text-[11px] leading-relaxed text-zinc-500">
                Hệ thống sẽ dùng Firebase hiện có để lưu tài khoản. ID của bạn sẽ được ánh xạ sang email nội bộ, nên không cần Gmail.
              </p>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState } from 'react';
import { Search, History, Book, Compass, Home, Sparkles, User, LogOut, Menu, X } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  user: FirebaseUser | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export default function Header({
  currentView,
  onNavigate,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  user,
  onOpenAuth,
  onSignOut,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = [
    { view: 'source', label: 'Nguồn Truyện', icon: Home },
    { view: 'genres', label: 'Thể Loại', icon: Compass },
    { view: 'history', label: 'Lịch Sử & Theo Dõi', icon: History },
  ];

  return (
    <header id="app-header" className="sticky top-0 z-50 w-full bg-zinc-950 border-b border-zinc-800 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo */}
          <div 
            id="app-logo"
            className="flex items-center gap-2 cursor-pointer shrink-0" 
            onClick={() => { onNavigate('source', { tab: 'recent' }); setMobileMenuOpen(false); }}
          >
            <span className="text-2xl font-black tracking-tighter text-rose-600 font-display">
              TLDepTrai
            </span>
          </div>

          {/* Search bar */}
          <form 
            id="search-form"
            onSubmit={onSearchSubmit} 
            className="flex-1 max-w-lg relative"
          >
            <div className="relative">
              <input
                id="search-input"
                type="text"
                placeholder="Tìm truyện tranh..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-zinc-900 text-zinc-100 placeholder-zinc-500 pl-4 pr-10 py-1.5 rounded-full border border-zinc-800 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-500 text-sm transition-all"
              />
              <button 
                id="search-submit"
                type="submit" 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-rose-500 p-1 cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Desktop Navigation */}
          <nav id="desktop-nav" className="hidden md:flex items-center gap-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.view;
              return (
                <button
                  id={`nav-item-${item.view}`}
                  key={item.view}
                  onClick={() => onNavigate(item.view, item.view === 'source' ? { tab: 'recent' } : undefined)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${
                    isActive 
                      ? 'bg-zinc-800 text-rose-500' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Status / Firebase Authentication */}
          <div id="user-profile-header" className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar'}
                    className="w-5 h-5 rounded-full object-cover border border-rose-500/20"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-rose-600 flex items-center justify-center text-[10px] font-black text-white">
                    {(user.displayName || user.email || 'A')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider hidden lg:inline max-w-[100px] truncate">
                  {user.displayName || 'Bạn đọc'}
                </span>
                <button
                  id="btn-signout-desktop"
                  onClick={onSignOut}
                  title="Đăng xuất khỏi tủ sách"
                  className="p-1 text-zinc-500 hover:text-rose-500 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                id="btn-signin-desktop"
                onClick={onOpenAuth}
                className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white bg-rose-600 hover:bg-rose-500 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Đăng nhập / Tạo tài khoản</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-drawer" className="md:hidden bg-zinc-950 border-b border-zinc-800 py-3 px-4 flex flex-col gap-1.5">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            return (
              <button
                id={`mobile-nav-item-${item.view}`}
                key={item.view}
                onClick={() => {
                  onNavigate(item.view, item.view === 'source' ? { tab: 'recent' } : undefined);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                  isActive 
                    ? 'bg-zinc-900 text-rose-500' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Mobile Auth Area */}
          <div className="border-t border-zinc-800 pt-3 mt-1.5">
            {user ? (
              <div className="flex items-center justify-between gap-4 px-2">
                <div className="flex items-center gap-3 min-w-0">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Avatar'}
                      className="w-8 h-8 rounded-full object-cover border border-rose-500/20"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-xs font-black text-white capitalize">
                      {(user.displayName || user.email || 'A')[0]}
                    </div>
                  )}
                  <div className="text-left min-w-0">
                    <p className="text-xs font-bold text-zinc-200 uppercase tracking-wider truncate">
                      {user.displayName || 'Bạn đọc'}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                
                <button
                  id="btn-signout-mobile"
                  onClick={() => {
                    onSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="p-2 bg-zinc-900 hover:bg-rose-950/30 hover:text-rose-400 rounded-full transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="btn-signin-mobile"
                onClick={() => {
                  onOpenAuth();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2.5 bg-rose-600 text-xs font-black uppercase tracking-widest text-white rounded-full hover:bg-rose-500 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-4 h-4" />
                <span>Đăng nhập / Tạo tài khoản</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

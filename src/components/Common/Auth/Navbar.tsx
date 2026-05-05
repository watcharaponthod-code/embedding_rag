import React from 'react';
import { Logo } from '../Logo';
import { AppView } from '../../../types';
import { LayoutDashboard, Search, ShieldCheck, MessageSquare, LogOut, User } from 'lucide-react';

interface NavbarProps {
  currentView: AppView;
  onChangeView: (view: AppView) => void;
  user: any;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onChangeView, user, onLogout }) => {

  const NavItem = ({ view, icon: Icon, label }: { view: AppView; icon: any; label: string }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => onChangeView(view)}
        className={`group relative flex items-center space-x-2.5 px-5 py-2.5 rounded-full transition-all duration-300 ease-out ${isActive
          ? 'bg-sycapt-red text-white shadow-soft' // Active: Sycapt Red
          : 'text-sycapt-gray hover:bg-sycapt-light-gray hover:text-sycapt-red' // Inactive: Grey -> Red text on hover
          }`}
      >
        <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
        <span className="font-medium tracking-tight">{label}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-sycapt-border shadow-sm ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-5">
        <div className="relative flex items-center justify-between h-16">
          {/* Logo Section (Left) */}
          <div
            className="flex-shrink-0 cursor-pointer transform transition-transform hover:scale-105 active:scale-95"
            onClick={() => onChangeView(AppView.UPLOAD)}
          >
            <Logo />
          </div>

          {/* Center Navigation (Absolute Center) */}
          <nav className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center p-1 bg-sycapt-light-gray rounded-full border border-sycapt-border shadow-sm">
            <NavItem view={AppView.UPLOAD} icon={LayoutDashboard} label="Ingest" />
            <NavItem view={AppView.SEARCH} icon={Search} label="Search" />
            <NavItem view={AppView.CHAT} icon={MessageSquare} label="Chat" />
          </nav>

          {/* Right Status (Right) */}
          <div className="flex items-center space-x-4 ml-auto">
            <div className="hidden sm:flex items-center space-x-3 bg-white px-4 py-1.5 rounded-full border border-gray-100 shadow-sm">
              <ShieldCheck size={16} className="text-green-500" />
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider leading-none">Status</span>
                <span className="text-xs font-semibold text-sycapt-dark leading-none mt-0.5">Secure</span>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>

            <div className="flex items-center space-x-3 group cursor-default">
              <div className="w-9 h-9 bg-sycapt-dark rounded-full flex items-center justify-center text-white shadow-md border-2 border-white ring-1 ring-gray-100">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <div className="hidden lg:flex flex-col">
                <span className="text-sm font-bold text-sycapt-dark leading-none">{user?.name || 'User'}</span>
                <span className="text-[10px] text-gray-400 font-medium leading-none mt-1">{user?.role || 'Member'}</span>
              </div>
              <button
                onClick={onLogout}
                className="ml-2 p-2 text-gray-400 hover:text-sycapt-red hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
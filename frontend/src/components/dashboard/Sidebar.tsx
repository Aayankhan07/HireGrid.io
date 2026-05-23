"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Screening } from '@/types';
import { 
  Plus, 
  Settings, 
  LogOut, 
  Layers, 
  Briefcase,
  Trash2,
  X
} from 'lucide-react';

interface SidebarProps {
  screenings: Screening[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onOpenNewScreening: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  screenings,
  activeId,
  onSelect,
  onDelete,
  onOpenNewScreening,
  isMobileOpen = false,
  onCloseMobile
}: SidebarProps) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-25 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`w-80 border-r border-white/5 bg-slate-950/80 backdrop-blur-xl flex flex-col h-screen fixed top-0 left-0 z-30 transition-transform duration-300 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-950/20">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              Hire<span className="text-blue-400">Grid</span><span className="text-slate-500">.io</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-1.5 font-semibold">Talent Engine</p>
          </div>
          
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          )}
        </div>

      {/* Action Button */}
      <div className="p-4">
        <button
          onClick={onOpenNewScreening}
          className="w-full glass-button-primary py-3 rounded-xl flex items-center justify-center gap-2 group transition-all duration-300"
        >
          <Plus className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-sm font-semibold tracking-wide">New Screening</span>
        </button>
      </div>

      {/* Screenings Timeline List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-3 py-1 mb-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Previous Screenings</span>
        </div>

        {screenings.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-600 italic">
            No past screenings loaded.
          </div>
        ) : (
          screenings.map((sc) => {
            const isActive = sc.id === activeId;
            return (
              <div
                key={sc.id}
                onClick={() => onSelect(sc.id)}
                className={`group flex items-center justify-between px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  isActive 
                    ? 'bg-blue-600/15 border border-blue-500/20 text-white font-medium' 
                    : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-500" />
                )}
                
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-900 text-slate-500 group-hover:text-slate-400'
                  }`}>
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate leading-tight">{sc.job_title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                      {sc.total_candidates} candidates • {sc.date}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => onDelete(sc.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 transition-all ml-1"
                  title="Delete screening"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* User profile block */}
      <div className="p-4 border-t border-white/5 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-2xl bg-white/5 border border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-xs font-bold text-white border border-white/10 shrink-0 shadow-inner">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : "AS"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || "Alex Sterling"}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.role || "Recruitment Lead"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  </>
  );
}

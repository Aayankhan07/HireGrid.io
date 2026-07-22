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

      <aside className={`w-80 border-r border-slate-800 bg-[#0d1326] flex flex-col h-screen fixed top-0 left-0 z-30 transition-transform duration-300 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#060913]/25">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">
              Hire<span className="text-blue-400">Grid</span><span className="text-slate-500">.io</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none mt-1.5 font-semibold">Talent Engine</p>
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
                className={`group flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 relative overflow-hidden ${
                  isActive 
                    ? 'bg-slate-800 border border-slate-700 text-white font-medium shadow-sm' 
                    : 'border border-transparent text-slate-400 hover:bg-[#080c18] hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500" />
                )}
                
                <div className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-slate-900 text-blue-450 border border-slate-800' : 'bg-[#080c18] text-slate-500 group-hover:text-slate-400 border border-slate-800'
                  }`}>
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate leading-tight font-medium">{sc.job_title}</p>
                    <p className="text-[10px] text-slate-500 mt-1.5 truncate font-normal">
                      {sc.total_candidates} candidates • {sc.date}
                    </p>
                  </div>
                </div>

                <button
                  onClick={(e) => onDelete(sc.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-450 p-1.5 rounded-md hover:bg-red-500/10 text-slate-550 transition-all ml-1"
                  title="Delete screening"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* System Status Indicator widget */}
      <div className="mx-4 mb-4 p-4 rounded-xl border border-slate-800 bg-[#080c18] space-y-3 text-left">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System Monitor</span>
          </div>
          <span className="text-[9px] font-mono text-slate-500">v2.0.0</span>
        </div>
        
        <div className="space-y-2 text-[10px] text-slate-400 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">NLP Engine</span>
            <span className="text-emerald-450 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              spaCy Active
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Database</span>
            <span className="text-emerald-450 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              SQLite Connected
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Transformer</span>
            <span className="text-blue-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              MiniLM-L6 loaded
            </span>
          </div>
        </div>
      </div>

      {/* User profile block */}
      <div className="p-4 border-t border-slate-800 bg-[#0d1326]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#080c18] border border-slate-800">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <div className="w-9 h-9 rounded-md bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-250 border border-slate-800 shrink-0">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : "AS"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || "Alex Sterling"}</p>
              <p className="text-[10px] text-slate-450 truncate mt-1">{user?.role || "Recruitment Lead"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-455 hover:bg-red-500/10 transition-colors cursor-pointer"
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

"use client";

import React, { useState, useEffect } from 'react';
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

  // Live engine status. Failure leaves the panel showing "—" rather than
  // asserting something untrue about the running system.
  const [systemStatus, setSystemStatus] = useState<{
    version?: string;
    extraction?: string;
    database?: string;
    embedding_model?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/system')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled) setSystemStatus(data); })
      .catch(() => { /* panel stays blank; not worth surfacing to a recruiter */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {/* Mobile Sidebar Overlay Backdrop.
          A convenience affordance only — the sidebar has its own close button,
          so this is aria-hidden rather than an announced control. */}
      {isMobileOpen && (
        <div
          aria-hidden="true"
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
              Hire<span className="text-blue-400">Grid</span><span className="text-content-muted">.io</span>
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
          <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Previous Screenings</span>
        </div>

        {screenings.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-content-muted italic">
            No past screenings loaded.
          </div>
        ) : (
          screenings.map((sc) => {
            const isActive = sc.id === activeId;
            return (
              // The row body and the delete action are siblings, not nested.
              // Nesting a button inside a clickable parent is invalid HTML and
              // makes the delete control unreachable in the tab order.
              <div
                key={sc.id}
                className={`group flex items-center justify-between px-3 py-3 rounded-lg transition-all duration-200 relative overflow-hidden ${
                  isActive
                    ? 'bg-slate-800 border border-slate-700 text-white font-medium shadow-sm'
                    : 'border border-transparent text-slate-400 hover:bg-[#080c18] hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500" aria-hidden="true" />
                )}

                <button
                  type="button"
                  onClick={() => onSelect(sc.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-slate-900 text-blue-400 border border-slate-800' : 'bg-[#080c18] text-content-faint group-hover:text-slate-400 border border-slate-800'
                  }`}>
                    <Briefcase className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm truncate leading-tight font-medium">{sc.job_title}</span>
                    <span className="block text-[10px] text-content-muted mt-1.5 truncate font-normal">
                      {sc.total_candidates} candidates • {sc.date}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={(e) => onDelete(sc.id, e)}
                  aria-label={`Delete screening: ${sc.job_title}`}
                  // focus-visible:opacity-100 is required: the control is
                  // opacity-0 at rest, so without it a keyboard user would
                  // focus an invisible button.
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-400 p-1.5 rounded-md hover:bg-red-500/10 text-content-tertiary transition-all ml-1 cursor-pointer"
                  title="Delete screening"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
          <span className="text-[9px] font-mono text-content-muted">v2.0.0</span>
        </div>
        
        {/* Reported by the backend, not hardcoded. These lines previously
            claimed "spaCy Active" for a library that is no longer installed
            and "SQLite Connected" regardless of the configured database. */}
        <div className="space-y-2 text-[10px] text-slate-400 font-mono">
          <div className="flex justify-between items-center">
            <span className="text-content-muted">Extraction</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {systemStatus?.extraction ?? '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-content-muted">Database</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {systemStatus?.database ?? '—'}
            </span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-content-muted shrink-0">Model</span>
            <span
              className="text-blue-400 font-semibold flex items-center gap-1 min-w-0"
              title={systemStatus?.embedding_model}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />
              <span className="truncate">{systemStatus?.embedding_model ?? '—'}</span>
            </span>
          </div>
        </div>
      </div>

      {/* User profile block */}
      <div className="p-4 border-t border-slate-800 bg-[#0d1326]">
        <div className="flex items-center justify-between p-2 rounded-lg bg-[#080c18] border border-slate-800">
          <div className="flex items-center gap-3 min-w-0 text-left">
            <div className="w-9 h-9 rounded-md bg-slate-850 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-800 shrink-0">
              {user?.name ? user.name.split(' ').map(n => n[0]).join('') : "AS"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">{user?.name || "Alex Sterling"}</p>
              <p className="text-[10px] text-content-muted truncate mt-1">{user?.role || "Recruitment Lead"}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  </>
  );
}

"use client";

import React, { useState, useEffect, useId, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { countShortlisted } from '@/lib/score';
import Sidebar from '@/components/dashboard/Sidebar';
import NewScreeningForm from '@/components/forms/NewScreeningForm';
import RankingTable from '@/components/dashboard/RankingTable';
import DeepAnalysis from '@/components/dashboard/DeepAnalysis';
import CandidateDrawer from '@/components/ui/CandidateDrawer';
import PipelineBoard from '@/components/dashboard/PipelineBoard';
import { Candidate, Screening } from '@/types';
import { 
  Users, 
  Award, 
  BarChart3, 
  Settings, 
  Terminal, 
  AlertCircle,
  TrendingUp,
  BookmarkCheck,
  UserCheck,
  Menu
} from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rankings' | 'analytics' | 'pipeline'>('rankings');
  
  // Modal & Drawer State
  const [isNewScreeningOpen, setIsNewScreeningOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Streaming Analysis States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const processingPanelRef = useRef<HTMLDivElement>(null);
  const processingTitleId = useId();

  // Focus is contained for the duration of the run. Deliberately no Escape
  // handler: cancelling an in-flight analysis by accident loses real work.
  useFocusTrap(processingPanelRef, isProcessing);

  // Load screenings from the backend.
  //
  // A failed request must never fall back to sample data: a recruiter cannot
  // tell fabricated candidates from real ones, and acting on invented scores is
  // far worse than seeing an error. Failures surface as an error banner instead.
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const fetchScreenings = async () => {
        setLoadError(null);
        try {
          const token = sessionStorage.getItem('hiregrid_io_token') || '';
          const response = await fetch('/api/screenings', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setScreenings(data ?? []);
            setActiveId(data && data.length > 0 ? data[0].id : null);
          } else {
            setScreenings([]);
            setActiveId(null);
            setLoadError(
              response.status === 401
                ? "Your session has expired. Please sign in again."
                : `Could not load screenings (HTTP ${response.status}).`
            );
          }
        } catch (err) {
          console.error("Error loading screenings:", err);
          setScreenings([]);
          setActiveId(null);
          setLoadError("Could not reach the analysis service. Check that the backend is running.");
        }
      };
      fetchScreenings();
    }
  }, [user]);

  const handleSelectScreening = (id: string) => {
    setActiveId(id);
    setSelectedCandidate(null);
    setIsDrawerOpen(false);
  };

  const handleDeleteScreening = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = sessionStorage.getItem('hiregrid_io_token') || '';
      const response = await fetch(`/api/screenings/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const updated = screenings.filter(sc => sc.id !== id);
        setScreenings(updated);
        if (activeId === id) {
          setActiveId(updated.length > 0 ? updated[0].id : null);
        }
      } else {
        console.error("Failed to delete screening from database");
      }
    } catch (err) {
      console.error("Error deleting screening:", err);
    }
  };

  const handleSelectCandidate = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setIsDrawerOpen(true);
  };

  // SSE Stream Processing Connector
  const handleStartScreening = async (formData: FormData) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingError(null);
    setProcessingLogs(["Connecting to talent matching engine..."]);

    const requiredSkillsString = formData.get("required_skills") as string;
    const reqSkillsList = requiredSkillsString
      ? requiredSkillsString.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    try {
      const token = sessionStorage.getItem('hiregrid_io_token') || '';
      const response = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        // Report what actually happened. A blanket "backend is down" message is
        // wrong for every status the server successfully returned — a 422 from
        // a missing field sent recruiters to check their server process.
        let detail = '';
        try {
          const body = await response.json();
          const d = body?.detail;
          detail = Array.isArray(d)
            ? d.map((e: { loc?: string[]; msg?: string }) =>
                `${e.loc?.slice(-1)[0] ?? 'field'}: ${e.msg ?? 'invalid'}`).join('; ')
            : (typeof d === 'string' ? d : '');
        } catch {
          /* non-JSON error body; fall through to the status-based message */
        }

        if (response.status === 401) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        if (response.status === 422) {
          throw new Error(detail || "Some required fields are missing or invalid.");
        }
        if (response.status === 413) {
          throw new Error("One or more resumes exceed the upload size limit.");
        }
        throw new Error(
          detail || `Analysis failed (HTTP ${response.status}). Check that the backend is running.`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith("data: ")) {
              try {
                const payload = JSON.parse(cleanLine.substring(6));
                
                if (payload.type === "status") {
                  setProcessingLogs(prev => [...prev, payload.message]);
                } else if (payload.type === "progress") {
                  setProcessingLogs(prev => [...prev, payload.message]);
                  if (payload.step && payload.total) {
                    setProcessingProgress(Math.round((payload.step / payload.total) * 100));
                  }
                } else if (payload.type === "result") {
                  // Screening fully parsed and persisted in DB
                  const newScreening = payload.data;
                  setScreenings(prev => [newScreening, ...prev]);
                  setActiveId(newScreening.id);
                  setProcessingLogs(prev => [...prev, "✓ Talent Screening completed successfully!"]);
                  setProcessingProgress(100);
                  
                  // Gracefully close processing screen
                  setTimeout(() => {
                    setIsProcessing(false);
                    setIsNewScreeningOpen(false);
                  }, 1000);
                }
              } catch (e) {
                console.error("Error decoding SSE stream packet:", e);
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Stream parse error:", err);
      const message = err?.message || 'Stream parsing encountered a failure.';
      setProcessingLogs(prev => [...prev, `✗ Fatal: ${message}`]);
      setProcessingError(`Analysis failed: ${message}`);
      setTimeout(() => {
        setIsProcessing(false);
      }, 3500);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#060913] flex flex-col items-center justify-center relative overflow-hidden" suppressHydrationWarning>
        <div className="p-8 rounded-2xl border border-slate-800 flex flex-col items-center gap-6 relative z-10 shadow-2xl bg-[#0d1326]" suppressHydrationWarning>
          {/* Simple, clean loading spinner */}
          <div className="relative w-10 h-10 flex items-center justify-center shrink-0" suppressHydrationWarning>
            <div className="absolute inset-0 rounded-full border border-slate-800 border-t-blue-500 animate-spin" suppressHydrationWarning />
          </div>

          <div className="text-center" suppressHydrationWarning>
            <h1 className="text-xl font-bold tracking-wider text-white">
              Hire<span className="text-blue-400">Grid</span><span className="text-content-muted">.io</span>
            </h1>
            <p className="text-[10px] text-content-muted uppercase tracking-widest leading-none mt-2.5 font-semibold">resolving session state...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeScreening = screenings.find(s => s.id === activeId) || null;

  // Compute Active Screening Statistics
  const totalCount = activeScreening?.candidates?.length || 0;
  const shortlistCount = countShortlisted(activeScreening?.candidates?.map(c => c.score) ?? []);
  const avgScore = totalCount > 0 
    ? (activeScreening?.candidates?.reduce((acc, curr) => acc + curr.score, 0) || 0) / totalCount 
    : 0;
  const maxScore = totalCount > 0 
    ? Math.max(...(activeScreening?.candidates?.map(c => c.score) || [0])) 
    : 0;

  return (
    <div className="flex min-h-screen bg-[#060913]">
      {/* Fixed Left Sidebar Navigation */}
      <Sidebar
        screenings={screenings}
        activeId={activeId}
        onSelect={(id) => {
          handleSelectScreening(id);
          setIsMobileSidebarOpen(false);
        }}
        onDelete={handleDeleteScreening}
        onOpenNewScreening={() => {
          setIsNewScreeningOpen(true);
          setIsMobileSidebarOpen(false);
        }}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Pane */}
      <main className="flex-1 pl-0 lg:pl-80 min-h-screen relative flex flex-col bg-[#060913]">
        {/* Dashboard Header Bar */}
        <header className="p-6 border-b border-slate-800 flex items-center justify-between z-10 bg-[#060913]/80 backdrop-blur-md sticky top-0">
          <div className="flex items-center gap-4 min-w-0">
            {/* Hamburger Button on Mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-white/5 bg-slate-900/50 text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
              title="Open Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-md">Talent Dashboard</span>
                <span className="text-xs text-content-muted">• {activeScreening?.date || "Analytics Active"}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1.5 truncate">
                {activeScreening ? activeScreening.job_title : "No Screening Active"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeScreening && (
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#080c18] border border-slate-800">
                <button
                  onClick={() => setActiveTab('rankings')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'rankings'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Rankings</span>
                </button>
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Deep Analysis</span>
                </button>
                <button
                  onClick={() => setActiveTab('pipeline')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'pipeline'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Pipeline</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dashboard Panels */}
        <section className="p-8 space-y-8 flex-1">
          {loadError && (
            <div
              role="alert"
              className="p-4 rounded-xl border border-red-900/60 bg-red-950/30 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-red-200">Could not load your screenings</h3>
                <p className="text-xs text-red-300/80 mt-1">{loadError}</p>
              </div>
            </div>
          )}
          {activeScreening ? (
            <>
              {/* Target Parameters Segment */}
              <div className="p-5 rounded-xl border border-slate-800 space-y-3 bg-[#0d1326] shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Required Stack Parameters</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {activeScreening.required_skills.map((skill, sIdx) => (
                    <span 
                      key={sIdx}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-[#080c18] border border-slate-800 text-slate-300"
                    >
                      {skill}
                    </span>
                  ))}
                  {activeScreening.required_skills.length === 0 && (
                    <span className="text-xs text-content-muted italic">No specific skill filters added</span>
                  )}
                </div>
              </div>

              {/* KPI Summary Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Average Fit KPI */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-5 bg-[#0d1326] shadow-md hover:bg-[#111830] hover:border-slate-700 transition-all duration-300 group">
                  <div className="relative shrink-0">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle-progress-blue"
                        strokeDasharray={`${avgScore.toFixed(0)}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Average Fit Score</span>
                    <h3 className="text-2xl font-black text-white mt-1 leading-none">{avgScore.toFixed(1)}%</h3>
                    <p className="text-[10px] text-content-muted mt-1 truncate">Overall candidate relevance</p>
                  </div>
                </div>

                {/* Top Match KPI */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-5 bg-[#0d1326] shadow-md hover:bg-[#111830] hover:border-slate-700 transition-all duration-300 group">
                  <div className="relative shrink-0">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle-progress-emerald"
                        strokeDasharray={`${maxScore.toFixed(0)}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <UserCheck className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Maximum Match Score</span>
                    <h3 className="text-2xl font-black text-white mt-1 leading-none">{maxScore.toFixed(0)}%</h3>
                    <p className="text-[10px] text-content-muted mt-1 truncate">Best fit prospective profile</p>
                  </div>
                </div>

                {/* Shortlist Funnel Yield */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-5 bg-[#0d1326] shadow-md hover:bg-[#111830] hover:border-slate-700 transition-all duration-300 group">
                  <div className="relative shrink-0">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="circle-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="circle-progress-indigo"
                        strokeDasharray={`${totalCount > 0 ? ((shortlistCount / totalCount) * 100).toFixed(0) : 0}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookmarkCheck className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <div className="text-left min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pipeline Yield</span>
                    <h3 className="text-2xl font-black text-white mt-1 leading-none text-left">
                      {totalCount > 0 ? ((shortlistCount / totalCount) * 100).toFixed(0) : 0}%
                    </h3>
                    <p className="text-[10px] text-content-muted mt-1 truncate">{shortlistCount} of {totalCount} short-listed</p>
                  </div>
                </div>
              </div>

              {/* Selected Tab Layout */}
              <div className="pt-2">
                {activeTab === 'rankings' ? (
                  <RankingTable 
                    candidates={activeScreening.candidates} 
                    onSelectCandidate={handleSelectCandidate} 
                  />
                ) : activeTab === 'analytics' ? (
                  <DeepAnalysis 
                    candidates={activeScreening.candidates} 
                    requiredSkills={activeScreening.required_skills} 
                  />
                ) : (
                  <PipelineBoard
                    candidates={activeScreening.candidates}
                    onUpdateCandidate={(updatedCand) => {
                      if (activeId) {
                        const updatedScreenings = screenings.map(sc => {
                          if (sc.id === activeId) {
                            return {
                              ...sc,
                              candidates: sc.candidates.map(c => c.candidate_id === updatedCand.candidate_id ? updatedCand : c)
                            };
                          }
                          return sc;
                        });
                        setScreenings(updatedScreenings);
                      }
                    }}
                    onSelectCandidate={handleSelectCandidate}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 py-32 flex flex-col items-center justify-center text-center max-w-3xl mx-auto shadow-2xl bg-[#0d1326]">
              <div className="w-14 h-14 rounded-xl bg-[#080c18] border border-slate-850 flex items-center justify-center text-content-faint mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">Ready for Talent Search</h2>
              <p className="text-sm text-content-muted mt-1 max-w-md">
                Launch a talent run to parse resume documents using advanced composite NLP rules.
              </p>
              <button
                onClick={() => setIsNewScreeningOpen(true)}
                className="glass-button-primary mt-6 px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <span>Create Screening Run</span>
              </button>
            </div>
          )}
        </section>

        {/* Modal Overlay: New Screening Parameters Form */}
        {isNewScreeningOpen && (
          <NewScreeningForm
            onClose={() => setIsNewScreeningOpen(false)}
            onSubmit={handleStartScreening}
            isLoading={isProcessing}
          />
        )}

        {/* Streaming Analysis Process Screen */}
        {isProcessing && (
          <div className="fixed inset-0 bg-[#060913]/95 backdrop-blur-sm flex items-center justify-center z-55 p-4">
            {/* No onEscape: an analysis run is in flight, and dismissing it with
                a stray keypress would discard work already spent. */}
            <div
              ref={processingPanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={processingTitleId}
              className="w-full max-w-2xl rounded-xl p-8 border border-slate-800 relative overflow-hidden flex flex-col gap-6 animate-slide-up shadow-2xl bg-[#0d1326]"
            >
              {/* Border accents */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" aria-hidden="true" />

              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-400 border border-slate-800 shrink-0">
                  <Terminal className="w-5 h-5 animate-pulse" aria-hidden="true" />
                </div>
                <div>
                  <h3 id={processingTitleId} className="text-lg font-bold text-white tracking-wide">HireGrid.io Engine Active</h3>
                  <p className="text-xs text-content-muted mt-0.5">Streaming pipeline logs and scoring candidate profiles.</p>
                </div>
              </div>

              {/* Progress bar. A progressbar role rather than a live region:
                  assistive tech polls the value on demand, whereas announcing
                  every increment of a per-candidate stream is unusable. */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-content-secondary">
                  <span>Match Progress</span>
                  <span>{processingProgress}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Match progress"
                  aria-valuenow={processingProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="w-full h-2 rounded-full bg-[#080c18] border border-slate-800 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>

              {/* Log Feed Terminal.
                  The array is reversed before mapping, so the newest entry is
                  the first DOM child while flex-col-reverse paints it at the
                  bottom. Live regions announce in DOM order, so new lines are
                  read as they arrive — keep the reverse() and the
                  flex-col-reverse in sync if either changes. */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-widest">Pipeline Events</span>
                <div
                  aria-live="polite"
                  aria-atomic="false"
                  aria-label="Pipeline events"
                  className="h-44 rounded-xl bg-[#080c18] border border-slate-800 p-4.5 font-mono text-[11px] leading-relaxed text-slate-400 overflow-y-auto space-y-1.5 flex flex-col-reverse shadow-inner"
                >
                  {processingLogs.slice().reverse().map((log, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 ${
                        log.startsWith('✓')
                          ? 'text-emerald-400'
                          : log.startsWith('✗')
                          ? 'text-red-400 font-bold'
                          : log.includes('[')
                          ? 'text-blue-400'
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="text-content-faint shrink-0" aria-hidden="true">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Failures are announced assertively so they are not queued
                  behind pending log lines. */}
              <div role="alert" className="sr-only">
                {processingError ?? ''}
              </div>
            </div>
          </div>
        )}

        {/* Slide-out Candidate Analysis Detail Drawer */}
        <CandidateDrawer
          candidate={selectedCandidate}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setTimeout(() => setSelectedCandidate(null), 300); // clear candidate after slide animation completes
          }}
          onUpdateCandidate={(updatedCand) => {
            setSelectedCandidate(updatedCand);
            if (activeId) {
              const updatedScreenings = screenings.map(sc => {
                if (sc.id === activeId) {
                  return {
                    ...sc,
                    candidates: sc.candidates.map(c => c.candidate_id === updatedCand.candidate_id ? updatedCand : c)
                  };
                }
                return sc;
              });
              setScreenings(updatedScreenings);
            }
          }}
        />
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
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

// Enterprise Seeding Data (Matches the screenshot and user's high standard)
const SEED_SCREENINGS: Screening[] = [
  {
    id: "seed-screening-1",
    job_title: "Senior Full Stack Engineer",
    total_candidates: 3,
    date: "May 22, 2026",
    required_skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker"],
    candidates: [
      {
        candidate_id: "alex_mckinney_cv.pdf",
        candidate_name: "Alex McKinney",
        score: 84.5,
        score_breakdown: {
          skills: 85.0,
          semantic_similarity: 90.0,
          experience: 100.0,
          education: 100.0,
          certifications: 50.0,
          location: 100.0,
          language: 100.0
        },
        matched_skills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        missing_skills: ["Docker"],
        extracted_info: {
          experience_years: 6.5,
          education: "Master",
          location: "Remote",
          languages: ["English", "Spanish"],
          certifications: ["AWS Certified Developer"],
          projects_count: 3,
          past_titles: ["Lead Software Engineer", "Full Stack Developer", "Junior Engineer"],
          projects: ["Omni-Channel FinTech SaaS", "Real-Time Collaboration Dashboard", "Inventory Tracking App"],
          email: "alex.mckinney@example.com",
          phone: "+1 (555) 019-2834"
        },
        summary: "Alex McKinney shows strong overall fit. Matches 4 required skill(s). Gaps: Docker. Experience level fully meets senior requirements (6.5 YOE). Outstanding semantic alignment with job description."
      },
      {
        candidate_id: "sarah_lin_cv.pdf",
        candidate_name: "Sarah Lin",
        score: 68.2,
        score_breakdown: {
          skills: 60.0,
          semantic_similarity: 70.0,
          experience: 80.0,
          education: 100.0,
          certifications: 0.0,
          location: 50.0,
          language: 100.0
        },
        matched_skills: ["React", "TypeScript", "Docker"],
        missing_skills: ["Node.js", "PostgreSQL"],
        extracted_info: {
          experience_years: 3.2,
          education: "Bachelor",
          location: "San Francisco",
          languages: ["English", "Mandarin"],
          certifications: [],
          projects_count: 2,
          past_titles: ["Frontend Developer", "Software Engineering Intern"],
          projects: ["Developer Portfolio v3", "Open-Source React UI Toolkit"],
          email: "sarah.lin@example.com",
          phone: "+1 (555) 014-9982"
        },
        summary: "Sarah Lin shows moderate overall fit. Matches 3 required skill(s). Gaps: Node.js, PostgreSQL. Experience level is slightly below target senior requirements. Fair conceptual and semantic alignment."
      },
      {
        candidate_id: "john_doe_cv.pdf",
        candidate_name: "John Doe",
        score: 42.0,
        score_breakdown: {
          skills: 20.0,
          semantic_similarity: 40.0,
          experience: 30.0,
          education: 50.0,
          certifications: 0.0,
          location: 50.0,
          language: 50.0
        },
        matched_skills: ["React"],
        missing_skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker"],
        extracted_info: {
          experience_years: 1.0,
          education: "High School",
          location: "Chicago",
          languages: ["English"],
          certifications: [],
          projects_count: 1,
          past_titles: ["Junior Associate Intern"],
          projects: ["HTML Personal Site"],
          email: "john.doe@example.com",
          phone: "+1 (555) 012-3456"
        },
        summary: "John Doe shows limited overall fit. Matches 1 required skill(s). Gaps: TypeScript, Node.js, PostgreSQL, Docker. Significant experience and seniority deficits detected. Auto-routed to review."
      }
    ]
  }
];

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
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

  // Load screenings dynamically from backend SQLite database
  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      const fetchScreenings = async () => {
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
            setScreenings(data);
            if (data.length > 0) {
              setActiveId(data[0].id);
            } else {
              setActiveId(null);
            }
          }
        } catch (err) {
          console.error("Error loading screenings:", err);
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
        throw new Error("Backend connection failed. Please ensure FastAPI is running.");
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
      setProcessingLogs(prev => [...prev, `✗ Fatal: ${err.message || 'Stream parsing encountered a failure.'}`]);
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
              Hire<span className="text-blue-400">Grid</span><span className="text-slate-500">.io</span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-2.5 font-semibold">resolving session state...</p>
          </div>
        </div>
      </div>
    );
  }

  const activeScreening = screenings.find(s => s.id === activeId) || null;

  // Compute Active Screening Statistics
  const totalCount = activeScreening?.candidates?.length || 0;
  const shortlistCount = activeScreening?.candidates?.filter(c => c.score >= 80).length || 0;
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
                <span className="text-xs text-slate-500">• {activeScreening?.date || "Analytics Active"}</span>
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
                    <span className="text-xs text-slate-500 italic">No specific skill filters added</span>
                  )}
                </div>
              </div>

              {/* KPI Summary Block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Average Fit KPI */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-450 border border-slate-800 shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Average Fit Score</span>
                    <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">{avgScore.toFixed(1)}%</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Overall candidate relevance index</p>
                  </div>
                </div>

                {/* Top Match KPI */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-450 border border-slate-800 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Maximum Match Score</span>
                    <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">{maxScore.toFixed(0)}%</h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">Best fit prospective profile</p>
                  </div>
                </div>

                {/* Shortlist Funnel Yield */}
                <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
                  <div className="w-12 h-12 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-455 border border-slate-800 shrink-0">
                    <BookmarkCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Pipeline Yield</span>
                    <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">
                      {totalCount > 0 ? ((shortlistCount / totalCount) * 100).toFixed(0) : 0}%
                    </h3>
                    <p className="text-[9px] text-slate-500 mt-0.5">{shortlistCount} of {totalCount} short-listed</p>
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
              <div className="w-14 h-14 rounded-xl bg-[#080c18] border border-slate-850 flex items-center justify-center text-slate-500 mb-4">
                <Users className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">Ready for Talent Search</h2>
              <p className="text-sm text-slate-450 mt-1 max-w-md">
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
            <div className="w-full max-w-2xl rounded-xl p-8 border border-slate-800 relative overflow-hidden flex flex-col gap-6 animate-slide-up shadow-2xl bg-[#0d1326]">
              {/* Border accents */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" />
              
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-450 border border-slate-800 shrink-0">
                  <Terminal className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-wide">HireGrid.io Engine Active</h3>
                  <p className="text-xs text-slate-450 mt-0.5">Streaming pipeline logs and scoring candidate profiles.</p>
                </div>
              </div>

              {/* Progress visual bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-350">
                  <span>Match Progress</span>
                  <span>{processingProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#080c18] border border-slate-800 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              </div>

              {/* Log Feed Terminal */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pipeline Events</span>
                <div className="h-44 rounded-xl bg-[#080c18] border border-slate-800 p-4.5 font-mono text-[11px] leading-relaxed text-slate-400 overflow-y-auto space-y-1.5 flex flex-col-reverse shadow-inner">
                  {processingLogs.slice().reverse().map((log, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-start gap-2 ${
                        log.startsWith('✓') 
                          ? 'text-emerald-450' 
                          : log.startsWith('✗') 
                          ? 'text-red-450 font-bold' 
                          : log.includes('[') 
                          ? 'text-blue-400' 
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="text-slate-650 shrink-0">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                </div>
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

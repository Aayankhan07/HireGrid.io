"use client";

import React, { useEffect } from 'react';
import { Candidate } from '@/types';
import { 
  X, 
  Award, 
  BookOpen, 
  Briefcase, 
  CheckCircle2, 
  MapPin, 
  Globe, 
  AlertCircle, 
  Sparkles, 
  ShieldAlert, 
  ShieldCheck,
  Zap
} from 'lucide-react';

interface CandidateDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CandidateDrawer({
  candidate,
  isOpen,
  onClose
}: CandidateDrawerProps) {
  
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!candidate) return null;

  const initials = candidate.candidate_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CV';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 60) return 'text-blue-400 border-blue-500/20 bg-blue-500/10';
    return 'text-slate-400 border-slate-500/20 bg-slate-500/10';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-400';
    if (score >= 60) return 'from-blue-500 to-indigo-400';
    return 'from-slate-500 to-slate-400';
  };

  // Safe mapping of score breakdown with defaults
  const breakdownItems = [
    { label: 'Semantic Alignment', value: candidate.score_breakdown?.semantic_similarity ?? 0 },
    { label: 'Core Skill Match', value: candidate.score_breakdown?.skills ?? 0 },
    { label: 'Experience Level', value: candidate.score_breakdown?.experience ?? 0 },
    { label: 'Education Level', value: candidate.score_breakdown?.education ?? 0 },
    { label: 'Certifications', value: candidate.score_breakdown?.certifications ?? 0 },
    { label: 'Preferred Location', value: candidate.score_breakdown?.location ?? 0 },
    { label: 'Language Fit', value: candidate.score_breakdown?.language ?? 0 }
  ];

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel */}
      <aside 
        className={`fixed top-0 right-0 h-screen w-full max-w-2xl bg-slate-950/95 backdrop-blur-2xl border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-50 transition-transform duration-300 ease-out overflow-y-auto flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white text-base border border-white/15 shadow-lg">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-wide">{candidate.candidate_name}</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {candidate.extracted_info?.education || 'Unknown Degree'} • {candidate.extracted_info?.experience_years || 0} YOE
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-xl border text-sm font-bold flex items-center gap-1.5 ${getScoreColor(candidate.score)}`}>
              <Zap className="w-4 h-4" />
              <span>{candidate.score.toFixed(0)}% Match</span>
            </div>
            <button 
              onClick={onClose}
              className="w-9 h-9 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-8 flex-1">
          {/* AI generated summary */}
          <div className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden bg-white/[0.01]">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest leading-none">HireGrid.io AI Summary</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {candidate.summary}
            </p>
            <div className="absolute right-[-20px] bottom-[-20px] w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl pointer-events-none" />
          </div>

          {/* Grid layout for detailed parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Experience Level</span>
                <p className="text-sm font-semibold text-white mt-0.5">{candidate.extracted_info?.experience_years ?? 0} Years</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Education Level</span>
                <p className="text-sm font-semibold text-white mt-0.5">{candidate.extracted_info?.education || 'Unknown'}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applicant Location</span>
                <p className="text-sm font-semibold text-white mt-0.5">{candidate.extracted_info?.location || 'Not Specified'}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-white/5 bg-slate-900/40 flex items-start gap-3">
              <Globe className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Spoken Languages</span>
                <p className="text-sm font-semibold text-white mt-0.5 truncate">
                  {candidate.extracted_info?.languages && candidate.extracted_info.languages.length > 0 
                    ? candidate.extracted_info.languages.join(', ') 
                    : 'English'}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown progress bar items */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weighted Matching Breakdown</h3>
              <p className="text-xs text-slate-500 mt-0.5">Component details parsed against target parameters.</p>
            </div>
            
            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-4">
              {breakdownItems.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-slate-200">{item.value.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden p-[0.5px]">
                    <div 
                      className={`h-full rounded-full bg-gradient-to-r ${getProgressBarColor(item.value)}`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Matched and missing skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Matched Skills */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Matched Core Stack ({candidate.matched_skills.length})</h4>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 min-h-[140px] flex flex-wrap gap-2 content-start">
                {candidate.matched_skills.map((skill, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  >
                    {skill}
                  </span>
                ))}
                {candidate.matched_skills.length === 0 && (
                  <span className="text-xs text-slate-500 italic">No skills matched directly.</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Missing Competencies ({candidate.missing_skills.length})</h4>
              </div>
              <div className="glass-panel p-4 rounded-xl border border-red-500/10 bg-red-500/5 min-h-[140px] flex flex-wrap gap-2 content-start">
                {candidate.missing_skills.map((skill, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 border border-red-500/20 text-red-300"
                  >
                    {skill}
                  </span>
                ))}
                {candidate.missing_skills.length === 0 && (
                  <span className="text-xs text-slate-500 italic">No critical skill gaps identified.</span>
                )}
              </div>
            </div>
          </div>

          {/* Career chronology details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Career Chronology & Role Matches</h3>
              <p className="text-xs text-slate-500 mt-0.5">Job history extracted sequentially from parsed CV document.</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-5 relative">
              {candidate.extracted_info?.past_titles && candidate.extracted_info.past_titles.length > 0 ? (
                candidate.extracted_info.past_titles.map((title: string, idx: number) => {
                  const isJunior = /junior|associate|intern|graduate/i.test(title);
                  const isSenior = /senior|lead|principal|manager|architect/i.test(title);
                  return (
                    <div key={idx} className="flex gap-4 relative">
                      {/* Timeline indicator bar */}
                      {idx < candidate.extracted_info.past_titles.length - 1 && (
                        <div className="absolute left-[13px] top-[26px] bottom-[-20px] w-0.5 bg-white/5" />
                      )}
                      
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border z-10 ${
                        isSenior 
                          ? 'bg-blue-500/15 border-blue-500/25 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.15)]' 
                          : isJunior 
                          ? 'bg-purple-500/10 border-purple-500/10 text-purple-400' 
                          : 'bg-slate-900 border-white/5 text-slate-400'
                      }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-bold text-white leading-tight">{title}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {idx === 0 ? 'Most Recent Engagement' : idx === 1 ? 'Previous Engagement' : 'Historic Core Position'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex gap-4 relative">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-900 border border-white/5 text-slate-400">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">Professional Profile Sequence</h4>
                    <p className="text-xs text-slate-500 mt-1">Parsed chronological text profile is mapped. Standard history is loaded.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Certifications & projects parsed list */}
          {(candidate.extracted_info?.certifications && candidate.extracted_info.certifications.length > 0) && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Professional Credentials</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.extracted_info.certifications.map((cert: string, idx: number) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 border border-white/5 text-slate-300"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      </aside>
    </>
  );
}

"use client";

import React, { useEffect, useId, useRef } from 'react';
import { Candidate } from '@/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getScoreBadgeClass, getScoreBarClass } from '@/lib/score';
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
  Zap,
  Copy,
  Check,
  HelpCircle,
  Brain
} from 'lucide-react';

interface CandidateDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateCandidate?: (updatedCandidate: Candidate) => void;
}

export default function CandidateDrawer({
  candidate,
  isOpen,
  onClose,
  onUpdateCandidate
}: CandidateDrawerProps) {
  const [status, setStatus] = React.useState(candidate?.status || 'Applied');
  const [notes, setNotes] = React.useState(candidate?.notes || '');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const statusId = useId();
  const notesId = useId();

  // Sync state when candidate changes
  useEffect(() => {
    if (candidate) {
      setStatus(candidate.status || 'Applied');
      setNotes(candidate.notes || '');
    }
  }, [candidate]);

  const handleStatusChange = async (newStatus: string) => {
    if (!candidate) return;
    setStatus(newStatus);
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('hiregrid_io_token') || '';
      const response = await fetch(`/api/candidates/${candidate.candidate_id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        if (onUpdateCandidate) {
          onUpdateCandidate({
            ...candidate,
            status: newStatus
          });
        }
      } else {
        console.error("Failed to update status");
      }
    } catch (err) {
      console.error("Error updating status:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!candidate) return;
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('hiregrid_io_token') || '';
      const response = await fetch(`/api/candidates/${candidate.candidate_id}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ notes: notes })
      });
      if (response.ok) {
        if (onUpdateCandidate) {
          onUpdateCandidate({
            ...candidate,
            notes: notes
          });
        }
      } else {
        console.error("Failed to update notes");
      }
    } catch (err) {
      console.error("Error updating notes:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadCV = async () => {
    if (!candidate) return;
    try {
      const token = sessionStorage.getItem('hiregrid_io_token') || '';
      const response = await fetch(`/api/candidates/${candidate.candidate_id}/cv`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = candidate.candidate_filename || `${candidate.candidate_name}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        console.error("Failed to download CV");
      }
    } catch (err) {
      console.error("Error downloading CV:", err);
    }
  };
  
  // Escape-to-close, focus containment, focus restore and scroll lock all come
  // from the shared hook rather than a bespoke keydown listener.
  useFocusTrap(panelRef, isOpen, onClose);

  // NOTE: every hook must run before the `if (!candidate)` early return below.
  // React identifies hooks by call order, so a hook placed after a conditional
  // return is skipped whenever that branch is taken — the hook count then
  // changes between renders and React throws "Rendered more hooks than during
  // the previous render". Add new hooks above the return, not below it.
  const interviewQuestions = React.useMemo(() => {
    if (!candidate) return [];
    const questions: { category: string; question: string }[] = [];

    if (candidate.matched_skills && candidate.matched_skills.length > 0) {
      const s1 = candidate.matched_skills[0];
      questions.push({
        category: "Matched Technical Core",
        question: `Can you walk us through a recent production architecture where you used ${s1} to solve a complex performance bottleneck?`
      });
      if (candidate.matched_skills.length > 1) {
        const s2 = candidate.matched_skills[1];
        questions.push({
          category: "Integration Patterns",
          question: `How do you handle integration and state synchronization between ${s1} and ${s2} under high load?`
        });
      }
    }

    if (candidate.missing_skills && candidate.missing_skills.length > 0) {
      const m1 = candidate.missing_skills[0];
      questions.push({
        category: "Skill Gap Ramp-up",
        question: `Our core stack relies heavily on ${m1}. What related tools do you have experience with that will enable you to ramp up on ${m1} quickly?`
      });
    }

    const yoe = candidate.extracted_info?.experience_years ?? 0;
    if (yoe >= 5) {
      questions.push({
        category: "Senior Technical Leadership",
        question: `With ${yoe} years of experience, how do you handle technical mentoring, code reviews, and resolving architectural trade-offs in sprint planning?`
      });
    } else {
      questions.push({
        category: "Debugging & Delivery",
        question: `Describe a challenging production bug you encountered recently. How did you diagnose, isolate, and patch it?`
      });
    }

    return questions;
  }, [candidate]);

  // ── All hooks are above this line ───────────────────────────────────────────
  if (!candidate) return null;

  const initials = candidate.candidate_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CV';

  // Shared with the ranking table and pipeline board so a candidate never
  // renders one colour here and another elsewhere.
  const getScoreColor = getScoreBadgeClass;
  const getProgressBarColor = getScoreBarClass;

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

  const handleCopyInterviewKit = () => {
    if (!candidate) return;
    const textToCopy = `HireGrid.io Interview Kit for ${candidate.candidate_name}\n\n` + 
      interviewQuestions.map((q, i) => `${i + 1}. [${q.category}]\n   ${q.question}`).join('\n\n');
    
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <>
      {/* Backdrop overlay. aria-hidden because Escape and the close button
          already expose this affordance; announcing a bare div adds noise. */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-out Drawer Panel.
          The drawer stays mounted and animates via translate-x, so when closed
          its contents would otherwise remain in the accessibility tree and the
          tab order. `inert` removes them entirely — a focus trap alone cannot
          fix that, because the problem is the *closed* state. */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        inert={!isOpen}
        className={`fixed top-0 right-0 h-screen w-full max-w-2xl bg-[#0d1326] border-l border-slate-800 shadow-2xl z-50 transition-transform duration-300 ease-out overflow-y-auto flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-[#0d1326]/90 backdrop-blur-sm z-10">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-slate-200 text-base border border-slate-700">
              {initials}
            </div>
            <div>
              <h2 id={titleId} className="text-xl font-bold text-white tracking-tight">{candidate.candidate_name}</h2>
              <p className="text-xs text-content-muted mt-1 font-medium">
                {candidate.extracted_info?.education || 'Unknown Degree'} • {candidate.extracted_info?.experience_years || 0} YOE
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${getScoreColor(candidate.score)}`}>
              <Zap className="w-3.5 h-3.5" />
              <span>{candidate.score.toFixed(0)}% Match</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close candidate details"
              className="w-9 h-9 rounded-lg border border-slate-800 bg-[#080c18] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-8 flex-1">
          {/* AI generated summary */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[#080c18]/80 text-left shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest leading-none">HireGrid.io AI Summary</h4>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {candidate.summary}
            </p>
          </div>

          {/* AI Tailored Interview Kit */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[#080c18] space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-widest">AI Tailored Interview Kit</h4>
              </div>
              <button
                onClick={handleCopyInterviewKit}
                className="px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Interview Kit</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {interviewQuestions.map((iq, idx) => (
                <div key={idx} className="p-3.5 rounded-lg border border-slate-850 bg-[#060913]/60 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    {idx + 1}. {iq.category}
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    "{iq.question}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recruiter Actions Section */}
          <div className="p-5 rounded-lg border border-slate-800 bg-[#080c18] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest">Recruiter Actions</h3>
              
              {/* CV Download button */}
              {candidate.candidate_id && (
                <button
                  onClick={handleDownloadCV}
                  className="px-3 py-1.5 rounded-md border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  Download Original CV
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status Selector */}
              <div className="space-y-1.5 text-left">
                <label htmlFor={statusId} className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">Candidate Status</label>
                {/* Values must match ALLOWED_CANDIDATE_STATUSES in backend/app.py;
                    the API rejects anything else with a 400. */}
                <select
                  id={statusId}
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isSaving}
                  className="w-full bg-[#060913] border border-slate-800 rounded-lg px-3 py-2 text-xs font-semibold text-slate-300 focus:border-blue-500 cursor-pointer"
                >
                  <option value="Applied">Applied</option>
                  <option value="Screening">Screening</option>
                  <option value="Shortlisted">Shortlisted</option>
                  <option value="Interview">Interview</option>
                  <option value="Offer">Offer</option>
                  <option value="Hired">Hired</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Status Badge display */}
              <div className="flex items-end pb-1 text-left">
                <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase ${
                  status === 'Shortlisted' || status === 'Hired' || status === 'Offer'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' :
                  status === 'Interview' || status === 'Screening'
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' :
                  status === 'Rejected' || status === 'Auto-Rejected'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/20' :
                  'bg-slate-800 text-slate-400 border border-slate-800'
                }`}>
                  Current Phase: {status}
                </span>
              </div>
            </div>

            {/* Recruiter Notes */}
            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label htmlFor={notesId} className="text-[10px] font-bold text-content-muted uppercase tracking-wider block">Recruiter Notes & Feedback</label>
                {isSaving && <span className="text-[9px] text-blue-400 animate-pulse font-semibold uppercase">Saving...</span>}
              </div>
              <textarea
                id={notesId}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Write interview feedback, technical ratings, or evaluation notes here..."
                className="w-full h-24 bg-[#060913] border border-slate-800 rounded-lg p-3 text-xs text-slate-300 placeholder-content-faint focus:border-blue-500 resize-none font-medium"
              />
              <p className="text-[9px] text-content-muted italic mt-1 text-right">Notes are saved automatically when clicking outside the input area.</p>
            </div>
          </div>

          {/* Grid layout for detailed parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/40 flex items-start gap-3 text-left">
              <Briefcase className="w-5 h-5 text-content-faint mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Experience Level</span>
                <p className="text-sm font-semibold text-white mt-1">{candidate.extracted_info?.experience_years ?? 0} Years</p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/40 flex items-start gap-3 text-left">
              <BookOpen className="w-5 h-5 text-content-faint mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Education Level</span>
                <p className="text-sm font-semibold text-white mt-1">{candidate.extracted_info?.education || 'Unknown'}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/40 flex items-start gap-3 text-left">
              <MapPin className="w-5 h-5 text-content-faint mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Applicant Location</span>
                <p className="text-sm font-semibold text-white mt-1">{candidate.extracted_info?.location || 'Not Specified'}</p>
              </div>
            </div>

            <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/40 flex items-start gap-3 text-left">
              <Globe className="w-5 h-5 text-content-faint mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-content-muted uppercase tracking-wider">Spoken Languages</span>
                <p className="text-sm font-semibold text-white mt-1 truncate">
                  {candidate.extracted_info?.languages && candidate.extracted_info.languages.length > 0 
                    ? candidate.extracted_info.languages.join(', ') 
                    : 'English'}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown progress bar items */}
          <div className="space-y-4">
            <div className="text-left">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Weighted Matching Breakdown</h3>
              <p className="text-xs text-content-muted mt-1">Component details parsed against target parameters.</p>
            </div>
            
            <div className="p-5 rounded-lg border border-slate-800 bg-[#080c18] space-y-4 text-left shadow-inner">
              {breakdownItems.map((item, idx) => (
                <div key={idx} className="space-y-2 group">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{item.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono ${
                      item.value >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      item.value >= 60 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-slate-900 text-content-muted border border-slate-800'
                    }`}>{item.value.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${getProgressBarColor(item.value)}`}
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
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Matched Core Stack ({candidate.matched_skills.length})</h4>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/50 min-h-[140px] flex flex-wrap gap-2 content-start">
                {candidate.matched_skills.map((skill, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  >
                    {skill}
                  </span>
                ))}
                {candidate.matched_skills.length === 0 && (
                  <span className="text-xs text-content-muted italic">No skills matched directly.</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Missing Competencies ({candidate.missing_skills.length})</h4>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#080c18]/50 min-h-[140px] flex flex-wrap gap-2 content-start">
                {candidate.missing_skills.map((skill, idx) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-red-500/10 border border-red-500/20 text-red-300"
                  >
                    {skill}
                  </span>
                ))}
                {candidate.missing_skills.length === 0 && (
                  <span className="text-xs text-content-muted italic">No critical skill gaps identified.</span>
                )}
              </div>
            </div>
          </div>

          {/* Career chronology details */}
          <div className="space-y-4">
            <div className="text-left">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Career Chronology & Role Matches</h3>
              <p className="text-xs text-content-muted mt-1">Job history extracted sequentially from parsed CV document.</p>
            </div>

            <div className="p-5 rounded-lg border border-slate-800 bg-[#080c18] space-y-5 relative text-left">
              {candidate.extracted_info?.past_titles && candidate.extracted_info.past_titles.length > 0 ? (
                candidate.extracted_info.past_titles.map((title: string, idx: number) => {
                  const isJunior = /junior|associate|intern|graduate/i.test(title);
                  const isSenior = /senior|lead|principal|manager|architect/i.test(title);
                  return (
                    <div key={idx} className="flex gap-4 relative">
                      {/* Timeline indicator bar */}
                      {idx < candidate.extracted_info.past_titles.length - 1 && (
                        <div className="absolute left-[13px] top-[26px] bottom-[-20px] w-0.5 bg-slate-800" />
                      )}
                      
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border z-10 ${
                        isSenior 
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                          : isJunior 
                          ? 'bg-purple-500/5 border-purple-500/10 text-purple-400' 
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        <Briefcase className="w-3.5 h-3.5" />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-semibold text-white leading-tight">{title}</h4>
                        <p className="text-xs text-content-muted mt-1.5 font-normal">
                          {idx === 0 ? 'Most Recent Engagement' : idx === 1 ? 'Previous Engagement' : 'Historic Core Position'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex gap-4 relative">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center bg-slate-900 border border-slate-800 text-slate-400">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white leading-tight">Professional Profile Sequence</h4>
                    <p className="text-xs text-content-muted mt-1">Parsed chronological text profile is mapped. Standard history is loaded.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Certifications & projects parsed list */}
          {(candidate.extracted_info?.certifications && candidate.extracted_info.certifications.length > 0) && (
            <div className="space-y-3 text-left">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Professional Credentials</h3>
              <div className="flex flex-wrap gap-2">
                {candidate.extracted_info.certifications.map((cert: string, idx: number) => (
                  <span 
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-900 border border-slate-800 text-content-secondary"
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

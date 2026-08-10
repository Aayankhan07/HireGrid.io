"use client";

import React, { useId, useRef } from 'react';
import { X, Award, CheckCircle2, AlertCircle, Sparkles, MapPin, BookOpen, Briefcase, Globe } from 'lucide-react';
import { Candidate } from '@/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getScoreBadgeClass, getScoreBarClass } from '@/lib/score';

interface CandidateComparisonModalProps {
  candidates: Candidate[];
  isOpen: boolean;
  onClose: () => void;
}

export default function CandidateComparisonModal({
  candidates,
  isOpen,
  onClose
}: CandidateComparisonModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Escape, focus containment, focus restore and scroll lock.
  useFocusTrap(panelRef, isOpen, onClose);

  if (!isOpen || candidates.length === 0) return null;

  // Shared with the ranking table and pipeline board so a candidate never
  // renders one colour here and another elsewhere.
  const getScoreColor = getScoreBadgeClass;
  const getProgressBarColor = getScoreBarClass;

  return (
    <div className="fixed inset-0 bg-[#060913]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-[#0d1326] shadow-2xl overflow-hidden my-8 animate-slide-up flex flex-col max-h-[90vh]"
      >
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-[#0d1326] shrink-0">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 id={titleId} className="text-xl font-bold text-white">Side-by-Side Candidate Comparison</h2>
              <p className="text-xs text-content-muted mt-0.5">Comparing {candidates.length} selected profiles across all criteria.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Matrix Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider w-1/4 border-b border-slate-800 bg-[#080c18]/50">
                    Evaluation Metric
                  </th>
                  {candidates.map((cand) => (
                    <th key={cand.candidate_id} className="py-3 px-4 border-b border-slate-800 bg-[#080c18]/50 text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0">
                          {cand.candidate_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{cand.candidate_name}</h4>
                          <span className={`inline-block px-2 py-0.5 mt-1 text-[10px] font-bold rounded border ${getScoreColor(cand.score)}`}>
                            {cand.score.toFixed(0)}% Overall Match
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                
                {/* Score Bar */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Overall Fit Score</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4">
                      <div className="space-y-1.5">
                        <span className="font-bold text-sm text-white">{cand.score.toFixed(1)}%</span>
                        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                          <div 
                            className={`h-full rounded-full ${getProgressBarColor(cand.score)}`}
                            style={{ width: `${cand.score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Experience YOE */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Experience Level</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 font-bold text-slate-200">
                      {cand.extracted_info?.experience_years ?? 0} Years
                    </td>
                  ))}
                </tr>

                {/* Education */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Education Level</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 text-slate-300">
                      {cand.extracted_info?.education || 'Degree Not Specified'}
                    </td>
                  ))}
                </tr>

                {/* Location */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Location & Mobility</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 text-slate-300">
                      {cand.extracted_info?.location || 'Not Specified'}
                    </td>
                  ))}
                </tr>

                {/* Core Matched Skills */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Core Matched Skills</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {cand.matched_skills.map((skill, sIdx) => (
                          <span key={sIdx} className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400">
                            {skill}
                          </span>
                        ))}
                        {cand.matched_skills.length === 0 && (
                          <span className="text-content-muted italic">No skills matched</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Missing Skills / Gaps */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Skill Gaps (Missing)</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {cand.missing_skills.map((skill, mIdx) => (
                          <span key={mIdx} className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] font-semibold text-red-400">
                            {skill}
                          </span>
                        ))}
                        {cand.missing_skills.length === 0 && (
                          <span className="text-emerald-400 font-semibold">Zero skill gaps</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Breakdown Sub-Scores */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Semantic Similarity</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 font-mono font-bold text-slate-200">
                      {cand.score_breakdown?.semantic_similarity?.toFixed(0) ?? 0}%
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">Certifications Score</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 font-mono font-bold text-slate-200">
                      {cand.score_breakdown?.certifications?.toFixed(0) ?? 0}%
                    </td>
                  ))}
                </tr>

                {/* AI Executive Summary */}
                <tr>
                  <td className="py-4 px-4 font-semibold text-slate-400 bg-[#080c18]/30">AI Executive Evaluation</td>
                  {candidates.map((cand) => (
                    <td key={cand.candidate_id} className="py-4 px-4 text-slate-300 leading-relaxed text-[11px] font-medium">
                      {cand.summary}
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#0d1326] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close Comparison View
          </button>
        </div>

      </div>
    </div>
  );
}

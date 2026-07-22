"use client";

import React from 'react';
import { ShieldAlert, Award, Star, BookOpen, AlertCircle } from 'lucide-react';

import { Candidate } from '@/types';

interface DeepAnalysisProps {
  candidates: Candidate[];
  requiredSkills: string[];
}

export default function DeepAnalysis({
  candidates,
  requiredSkills
}: DeepAnalysisProps) {
  
  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center py-20 text-center bg-[#0d1326]">
        <AlertCircle className="w-12 h-12 text-slate-500 mb-3" />
        <p className="text-slate-400 font-semibold text-sm">No analysis metrics available</p>
        <p className="text-slate-500 text-xs mt-1">Please process a set of resumes to display deep analytical insights.</p>
      </div>
    );
  }

  // Calculate statistics
  const totalCount = candidates.length;
  const scores = candidates.map(c => c.score);
  const avgScore = scores.reduce((a, b) => a + b, 0) / totalCount;
  const maxScore = Math.max(...scores);
  
  // Status distributions
  const shortlistCount = candidates.filter(c => c.score >= 80).length;
  const reviewCount = candidates.filter(c => c.score >= 60 && c.score < 80).length;
  const pendingCount = candidates.filter(c => c.score < 60).length;

  // Skill match counts
  const skillFrequency: Record<string, number> = {};
  requiredSkills.forEach(skill => {
    skillFrequency[skill] = 0;
  });

  candidates.forEach(cand => {
    cand.matched_skills.forEach(skill => {
      const sLower = skill.toLowerCase();
      const matchedKey = requiredSkills.find(s => s.toLowerCase() === sLower);
      if (matchedKey) {
        skillFrequency[matchedKey] = (skillFrequency[matchedKey] || 0) + 1;
      }
    });
  });

  const skillMetrics = Object.entries(skillFrequency)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count);

  // Common missing skills
  const missingSkillFrequency: Record<string, number> = {};
  candidates.forEach(cand => {
    cand.missing_skills.forEach(skill => {
      missingSkillFrequency[skill] = (missingSkillFrequency[skill] || 0) + 1;
    });
  });

  const missingSkillMetrics = Object.entries(missingSkillFrequency)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      
      {/* Visual KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI: Average Fit */}
        <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-blue-500/5 flex items-center justify-center text-blue-450 border border-slate-800 shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Average Fit Score</span>
            <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">{avgScore.toFixed(1)}%</h3>
            <p className="text-[10px] text-slate-500 mt-1">Across all screened resumes</p>
          </div>
        </div>

        {/* KPI: Top Matching */}
        <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/5 flex items-center justify-center text-emerald-455 border border-slate-800 shrink-0">
            <Star className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Maximum Match Score</span>
            <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">{maxScore.toFixed(0)}%</h3>
            <p className="text-[10px] text-slate-500 mt-1">Best prospective match fit</p>
          </div>
        </div>

        {/* KPI: Pipeline funnel */}
        <div className="p-6 rounded-xl border border-slate-800 flex items-center gap-4 bg-[#0d1326] shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/5 flex items-center justify-center text-indigo-455 border border-slate-800 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Shortlist Yield</span>
            <h3 className="text-2xl font-bold text-white mt-1.5 -tracking-tight">{((shortlistCount / totalCount) * 100).toFixed(0)}%</h3>
            <p className="text-[10px] text-slate-500 mt-1">{shortlistCount} shortlisted candidates</p>
          </div>
        </div>
      </div>

      {/* Detail Analytics Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Analytics Card: Skills Match Frequencies */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0d1326] space-y-4 shadow-lg">
          <div className="text-left">
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Required Skills Matching Rate</h4>
            <p className="text-xs text-slate-500 mt-1">Appearance rate of required skills across scanned profiles.</p>
          </div>

          <div className="space-y-4 pt-3">
            {skillMetrics.map((sm, idx) => (
              <div key={idx} className="flex items-center gap-3 group">
                <span className="w-24 text-xs font-bold text-slate-300 text-right truncate group-hover:text-white transition-colors" title={sm.name}>
                  {sm.name}
                </span>
                <div className="flex-1">
                  <div className="relative w-full h-5.5 rounded bg-slate-950/60 border border-slate-850 overflow-hidden flex items-center">
                    <div 
                      className="h-full bg-blue-600/80 rounded-r border-r border-blue-400/30 transition-all duration-500"
                      style={{ width: `${sm.percentage}%` }}
                    />
                    <span className="absolute right-3 text-[10px] font-bold font-mono text-slate-350">
                      {sm.count} / {totalCount} ({sm.percentage.toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Grid axis lines at the bottom */}
            <div className="flex pl-27 justify-between text-[9px] font-mono text-slate-550 pt-2.5 border-t border-slate-850/60">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Analytics Card: Skills Gaps & Funnel Status */}
        <div className="p-6 rounded-xl border border-slate-800 bg-[#0d1326] space-y-6">
          
          {/* Section: Common Skill Gaps */}
          <div className="space-y-3">
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Common Missing Talent Gaps</h4>
              <p className="text-xs text-slate-500 mt-1">The most common skills missing in parsed candidates.</p>
            </div>
            
            <div className="space-y-2 pt-1">
              {missingSkillMetrics.map((mm, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-lg border border-red-500/10 bg-red-950/10 text-left">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200">{mm.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-400 uppercase bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded">
                    {mm.count} candidates missing ({mm.percentage.toFixed(0)}%)
                  </span>
                </div>
              ))}
              {missingSkillMetrics.length === 0 && (
                <p className="text-xs text-slate-500 italic py-4">No critical skill gaps identified.</p>
              )}
            </div>
          </div>

          {/* Section: Funnel Status Breakdown */}
          <div className="space-y-3 border-t border-slate-800 pt-5">
            <div className="text-left">
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Scoring Tier Distribution</h4>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-lg border border-emerald-500/10 bg-emerald-500/5 text-center">
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Shortlist</span>
                <p className="text-xl font-bold text-emerald-450 mt-1">{shortlistCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((shortlistCount/totalCount)*100).toFixed(0)}%)</p>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-500/10 bg-amber-500/5 text-center">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Review</span>
                <p className="text-xl font-bold text-amber-450 mt-1">{reviewCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((reviewCount/totalCount)*100).toFixed(0)}%)</p>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/40 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
                <p className="text-xl font-bold text-slate-450 mt-1">{pendingCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((pendingCount/totalCount)*100).toFixed(0)}%)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

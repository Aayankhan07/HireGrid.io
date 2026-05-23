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
      <div className="glass-card border-dashed flex flex-col items-center justify-center py-20 text-center">
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
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Average Fit Score</span>
            <h3 className="text-3xl font-extrabold text-white mt-0.5">{avgScore.toFixed(1)}%</h3>
            <p className="text-[10px] text-slate-400 mt-1">Across all screened resumes</p>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 bg-blue-500/5 rounded-full filter blur-xl" />
        </div>

        {/* KPI: Top Matching */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shrink-0">
            <Star className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Maximum Match Score</span>
            <h3 className="text-3xl font-extrabold text-white mt-0.5">{maxScore.toFixed(0)}%</h3>
            <p className="text-[10px] text-slate-400 mt-1">Best prospective match fit</p>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 bg-emerald-500/5 rounded-full filter blur-xl" />
        </div>

        {/* KPI: Pipeline funnel */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Shortlist Yield</span>
            <h3 className="text-3xl font-extrabold text-white mt-0.5">{((shortlistCount / totalCount) * 100).toFixed(0)}%</h3>
            <p className="text-[10px] text-slate-400 mt-1">{shortlistCount} shortlisted candidates</p>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 bg-indigo-500/5 rounded-full filter blur-xl" />
        </div>
      </div>

      {/* Detail Analytics Splits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Analytics Card: Skills Match Frequencies */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Required Skills Matching Rate</h4>
            <p className="text-xs text-slate-500 mt-0.5">Which required skills appear most frequently across all candidates.</p>
          </div>

          <div className="space-y-4.5 pt-2">
            {skillMetrics.map((sm, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">{sm.name}</span>
                  <span className="text-slate-400">{sm.count} / {totalCount} ({sm.percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden p-[1px]">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-400"
                    style={{ width: `${sm.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Card: Skills Gaps & Funnel Status */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
          
          {/* Section: Common Skill Gaps */}
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Common Missing Talent Gaps</h4>
              <p className="text-xs text-slate-500 mt-0.5">The most common skills missing in parsed candidates.</p>
            </div>
            
            <div className="space-y-2.5 pt-1">
              {missingSkillMetrics.map((mm, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-red-500/10 bg-red-950/5">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-200">{mm.name}</span>
                  </div>
                  <span className="text-[10px] font-bold text-red-400 uppercase bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded-md">
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
          <div className="space-y-3 border-t border-white/5 pt-5">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Scoring Tier Distribution</h4>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-center">
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Shortlist</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">{shortlistCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((shortlistCount/totalCount)*100).toFixed(0)}%)</p>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-500/10 bg-amber-500/5 text-center">
                <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Review</span>
                <p className="text-xl font-extrabold text-amber-400 mt-1">{reviewCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((reviewCount/totalCount)*100).toFixed(0)}%)</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-500/15 bg-slate-500/5 text-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pending</span>
                <p className="text-xl font-extrabold text-slate-400 mt-1">{pendingCount}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">({((pendingCount/totalCount)*100).toFixed(0)}%)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

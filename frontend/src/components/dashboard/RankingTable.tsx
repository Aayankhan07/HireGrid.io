"use client";

import React from 'react';
import { ChevronRight, Filter, Download } from 'lucide-react';

import { Candidate } from '@/types';

interface RankingTableProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
}

export default function RankingTable({
  candidates,
  onSelectCandidate
}: RankingTableProps) {

  const getStatus = (score: number) => {
    if (score >= 80) return { label: 'Shortlist', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    if (score >= 60) return { label: 'Review', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    return { label: 'Pending', colorClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 80) return 'from-emerald-500 to-teal-400';
    if (score >= 60) return 'from-blue-500 to-indigo-400';
    return 'from-slate-500 to-slate-400';
  };

  const handleExportCSV = () => {
    if (candidates.length === 0) return;
    
    // Construct CSV content
    const headers = ["Rank", "Candidate Name", "Match Score", "Experience YOE", "Education", "Location", "Matched Skills", "Summary"];
    const rows = candidates.map((c, i) => [
      i + 1,
      c.candidate_name,
      c.score,
      c.extracted_info.experience_years || 0,
      c.extracted_info.education || 'Unknown',
      c.extracted_info.location || 'Unknown',
      c.matched_skills.join('; '),
      c.summary.replace(/"/g, '""')
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `HireGrid_IO_Screening_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Table Actions Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-400 font-medium">
          Showing <span className="text-white font-semibold">{candidates.length}</span> candidates ranked
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="glass-button py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* High Fidelity Glassmorphism Table Grid */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 text-[11px] font-bold text-slate-500 uppercase tracking-widest bg-slate-950/20">
                <th className="py-4.5 pl-6 pr-4 text-center w-16">Rank</th>
                <th className="py-4.5 px-4 min-w-[200px]">Candidate Details</th>
                <th className="py-4.5 px-4 w-[160px]">Match Score</th>
                <th className="py-4.5 px-4 text-center w-[120px]">Status</th>
                <th className="py-4.5 px-4 min-w-[200px]">Matched Core Stack</th>
                <th className="py-4.5 pr-6 pl-4 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {candidates.map((cand, idx) => {
                const statusInfo = getStatus(cand.score);
                const progressColor = getProgressBarColor(cand.score);
                const initials = cand.candidate_name
                  .split(' ')
                  .map(n => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'CV';

                return (
                  <tr
                    key={cand.candidate_id}
                    onClick={() => onSelectCandidate(cand)}
                    className="group hover:bg-white/[0.02] cursor-pointer transition-colors duration-150"
                  >
                    {/* Rank Circle */}
                    <td className="py-4.5 pl-6 pr-4 text-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]' 
                          : idx === 1 
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                          : 'bg-slate-900 border border-white/5 text-slate-400'
                      }`}>
                        {idx + 1}
                      </div>
                    </td>

                    {/* Candidate Identity Profile */}
                    <td className="py-4.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border border-white/10 ${
                          idx === 0 
                            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white' 
                            : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white'
                        }`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors leading-tight truncate">
                            {cand.candidate_name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {cand.extracted_info.education || 'Degree'} • {cand.extracted_info.experience_years || 0} YOE
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Match Score Display */}
                    <td className="py-4.5 px-4">
                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between text-xs font-bold text-white">
                          <span className="text-sm">{cand.score}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden p-[1px]">
                          <div 
                            className={`h-full rounded-full bg-gradient-to-r ${progressColor}`}
                            style={{ width: `${cand.score}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-4.5 px-4 text-center">
                      <span className={`inline-block px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${statusInfo.colorClass}`}>
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Core matched skills pills */}
                    <td className="py-4.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-[340px]">
                        {cand.matched_skills.slice(0, 3).map((skill, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-900 border border-white/5 text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                        {cand.matched_skills.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-white/5 border border-white/5 text-slate-500">
                            +{cand.matched_skills.length - 3} more
                          </span>
                        )}
                        {cand.matched_skills.length === 0 && (
                          <span className="text-[10px] text-slate-600 italic">No skills match</span>
                        )}
                      </div>
                    </td>

                    {/* Chevron trigger link */}
                    <td className="py-4.5 pr-6 pl-4 text-right">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-white group-hover:bg-white/5 transition-all">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useMemo } from 'react';
import { ChevronRight, Filter, Download, Search, ArrowUpDown, Layers, UserCheck, UserX } from 'lucide-react';
import { Candidate } from '@/types';
import CandidateComparisonModal from '@/components/ui/CandidateComparisonModal';
import { getScoreBadgeClass, getScoreBarClass, getScoreLabel } from '@/lib/score';

interface RankingTableProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
  onUpdateCandidate?: (updatedCandidate: Candidate) => void;
}

export default function RankingTable({
  candidates,
  onSelectCandidate,
  onUpdateCandidate
}: RankingTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'score-desc' | 'score-asc' | 'yoe-desc' | 'name-asc'>('score-desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  const getStatus = (score: number) => ({
    label: getScoreLabel(score),
    colorClass: getScoreBadgeClass(score),
  });

  const getProgressBarColor = getScoreBarClass;

  // Search & Sorting Filter Computation
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => {
        const nameMatch = c.candidate_name.toLowerCase().includes(q);
        const eduMatch = (c.extracted_info?.education || '').toLowerCase().includes(q);
        const skillMatch = c.matched_skills.some(s => s.toLowerCase().includes(q));
        return nameMatch || eduMatch || skillMatch;
      });
    }

    result.sort((a, b) => {
      if (sortOption === 'score-desc') return b.score - a.score;
      if (sortOption === 'score-asc') return a.score - b.score;
      if (sortOption === 'yoe-desc') {
        const yoeA = a.extracted_info?.experience_years ?? 0;
        const yoeB = b.extracted_info?.experience_years ?? 0;
        return yoeB - yoeA;
      }
      if (sortOption === 'name-asc') return a.candidate_name.localeCompare(b.candidate_name);
      return 0;
    });

    return result;
  }, [candidates, searchQuery, sortOption]);

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCandidates.map(c => c.candidate_id));
    }
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedIds.length === 0) return;
    const token = sessionStorage.getItem('hiregrid_io_token') || '';

    for (const id of selectedIds) {
      try {
        await fetch(`/api/candidates/${id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (err) {
        console.error("Bulk status update error:", err);
      }
    }

    if (onUpdateCandidate) {
      candidates.forEach(c => {
        if (selectedIds.includes(c.candidate_id)) {
          onUpdateCandidate({ ...c, status: newStatus });
        }
      });
    }
    setSelectedIds([]);
  };

  const selectedCandidatesList = useMemo(() => {
    return candidates.filter(c => selectedIds.includes(c.candidate_id));
  }, [candidates, selectedIds]);

  const handleExportCSV = () => {
    if (candidates.length === 0) return;
    
    // Construct CSV content
    const headers = ["Rank", "Candidate Name", "Match Score", "Experience YOE", "Education", "Location", "Matched Skills", "Summary"];
    const rows = filteredCandidates.map((c, i) => [
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
      {/* Table Actions & Filters Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-content-muted">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by candidate name, degree, or skill..."
            className="glass-input w-full py-2 pl-9 pr-4 text-xs"
          />
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-3 justify-end">
          
          {/* Bulk Action Buttons */}
          {selectedIds.length > 0 && (
            <>
              <button
                onClick={() => handleBulkStatusChange('Shortlisted')}
                className="py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all cursor-pointer animate-fade-in"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Shortlist ({selectedIds.length})</span>
              </button>
              <button
                onClick={() => handleBulkStatusChange('Rejected')}
                className="py-2 px-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/20 transition-all cursor-pointer animate-fade-in"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Reject ({selectedIds.length})</span>
              </button>
            </>
          )}

          {/* Compare Button */}
          {selectedIds.length >= 2 && (
            <button
              onClick={() => setIsComparisonOpen(true)}
              className="glass-button-primary py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer animate-fade-in"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Compare Selected ({selectedIds.length})</span>
            </button>
          )}

          {/* Sort Option Selector */}
          <div className="relative flex items-center gap-1.5 bg-[#0d1326] border border-slate-800 rounded-xl px-3 py-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-content-faint" />
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="bg-transparent text-slate-300 text-xs font-semibold cursor-pointer"
            >
              <option value="score-desc" className="bg-[#0d1326]">Score (High → Low)</option>
              <option value="score-asc" className="bg-[#0d1326]">Score (Low → High)</option>
              <option value="yoe-desc" className="bg-[#0d1326]">YOE (High → Low)</option>
              <option value="name-asc" className="bg-[#0d1326]">Candidate Name (A → Z)</option>
            </select>
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="glass-button py-2 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

        </div>
      </div>

      {/* Table Grid */}
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative bg-[#0d1326]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-[#060913]/30">
                <th className="py-4.5 pl-4 pr-2 text-center w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredCandidates.length && filteredCandidates.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded bg-[#060913] border-slate-700 text-blue-500 cursor-pointer"
                    title="Select All Candidates"
                  />
                </th>
                <th className="py-4.5 px-3 text-center w-14">Rank</th>
                <th className="py-4.5 px-4 min-w-[200px]">Candidate Details</th>
                <th className="py-4.5 px-4 w-[160px]">Match Score</th>
                <th className="py-4.5 px-4 text-center w-[120px]">Status</th>
                <th className="py-4.5 px-4 min-w-[200px]">Matched Core Stack</th>
                <th className="py-4.5 pr-6 pl-4 text-right w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-content-muted italic">
                    No candidates match the filter parameters.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((cand, idx) => {
                  const statusInfo = getStatus(cand.score);
                  const progressColor = getProgressBarColor(cand.score);
                  const isSelected = selectedIds.includes(cand.candidate_id);
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
                      className={`group hover:bg-[#080c18]/60 cursor-pointer transition-colors duration-150 ${
                        isSelected ? 'bg-[#080c18]/90' : ''
                      }`}
                    >
                      {/* Checkbox for side-by-side selection */}
                      <td className="py-4.5 pl-4 pr-2 text-center" onClick={(e) => handleToggleSelect(cand.candidate_id, e)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 rounded bg-[#060913] border-slate-700 text-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Rank Circle */}
                      <td className="py-4.5 px-3 text-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold mx-auto ${
                          idx === 0 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                            : idx === 1 
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                            : 'bg-slate-900 border border-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </div>
                      </td>

                      {/* Candidate Identity Profile */}
                      <td className="py-4.5 px-4 text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-xs shrink-0 border border-slate-800 bg-slate-800 text-slate-200">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors leading-tight truncate">
                              {cand.candidate_name}
                            </p>
                            <p className="text-[11px] text-content-muted truncate mt-1">
                              {cand.extracted_info?.education || 'Degree'} • {cand.extracted_info?.experience_years || 0} YOE
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Match Score Display */}
                      <td className="py-4.5 px-4 text-left">
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs font-bold text-white">
                            <span className="text-sm">{cand.score}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden border border-slate-900">
                            <div 
                              className={`h-full rounded-full ${progressColor}`}
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
                              className="px-2 py-1 rounded bg-[#080c18] border border-slate-800 text-[10px] font-medium text-slate-300"
                            >
                              {skill}
                            </span>
                          ))}
                          {cand.matched_skills.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-bold text-content-muted">
                              +{cand.matched_skills.length - 3} more
                            </span>
                          )}
                          {cand.matched_skills.length === 0 && (
                            <span className="text-[10px] text-content-muted italic">No skills match</span>
                          )}
                        </div>
                      </td>

                      {/* Chevron trigger link */}
                      <td className="py-4.5 pr-6 pl-4 text-right">
                        <div className="w-7 h-7 rounded-md flex items-center justify-center text-content-faint group-hover:text-white group-hover:bg-slate-800 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side by side comparison modal */}
      <CandidateComparisonModal
        candidates={selectedCandidatesList}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />
    </div>
  );
}

"use client";
import React, { useState } from 'react';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  UserCheck, 
  XCircle, 
  Check, 
  X, 
  RotateCcw, 
  Briefcase, 
  GraduationCap,
  ExternalLink
} from 'lucide-react';
import { Candidate } from '@/types';
import { getScoreBadgeClass } from '@/lib/score';

interface PipelineBoardProps {
  candidates: Candidate[];
  onUpdateCandidate: (updatedCandidate: Candidate) => void;
  onSelectCandidate: (candidate: Candidate) => void;
}

export default function PipelineBoard({
  candidates,
  onUpdateCandidate,
  onSelectCandidate
}: PipelineBoardProps) {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  // Group candidates by status
  const pendingCandidates = candidates.filter(
    c => !c.status || c.status === 'Applied'
  );
  
  const selectedCandidates = candidates.filter(
    c => c.status === 'Shortlisted' || c.status === 'Interviewing'
  );
  
  const rejectedCandidates = candidates.filter(
    c => c.status === 'Rejected'
  );

  const handleUpdateStatus = async (candidate: Candidate, newStatus: string) => {
    setIsUpdating(candidate.candidate_id);
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
        onUpdateCandidate({
          ...candidate,
          status: newStatus
        });
      } else {
        console.error("Failed to update status on board");
      }
    } catch (err) {
      console.error("Error transitioning candidate status:", err);
    } finally {
      setIsUpdating(null);
    }
  };


  const renderCandidateCard = (cand: Candidate) => {
    const email = cand.extracted_info?.email || "";
    const phone = cand.extracted_info?.phone || "";
    const isPending = !cand.status || cand.status === 'Applied';
    const isSelected = cand.status === 'Shortlisted' || cand.status === 'Interviewing';
    const isRejected = cand.status === 'Rejected';
    const loadingCard = isUpdating === cand.candidate_id;

    return (
      <div 
        key={cand.candidate_id}
        className={`p-4 rounded-lg border border-slate-800 bg-[#080c18] relative transition-all duration-300 hover:border-slate-700 hover:shadow-sm ${
          loadingCard ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="min-w-0 text-left">
            <h5 className="text-sm font-semibold text-white leading-tight truncate pr-2">
              {cand.candidate_name}
            </h5>
            <span className="text-[10px] text-content-muted leading-normal block truncate mt-1">
              {cand.candidate_filename || "resume.pdf"}
            </span>
          </div>
          <span className={`inline-block px-2 py-0.5 text-[10px] font-bold font-mono rounded border shrink-0 ${getScoreBadgeClass(cand.score)}`}>
            {cand.score.toFixed(0)}% Match
          </span>
        </div>

        {/* Basic Stats */}
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-slate-400 text-left border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <Briefcase className="w-3.5 h-3.5 text-content-faint shrink-0" />
            <span className="truncate">{cand.extracted_info?.experience_years ?? 0} YOE</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <GraduationCap className="w-3.5 h-3.5 text-content-faint shrink-0" />
            <span className="truncate">{cand.extracted_info?.education || "Unknown"}</span>
          </div>
          <div className="col-span-2 flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-content-faint shrink-0" />
            <span className="truncate">{cand.extracted_info?.location || "Remote / On-site"}</span>
          </div>
        </div>

        {/* Contact info block */}
        {(email || phone) && (
          <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-400 text-left">
            {email && (
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-content-faint shrink-0" />
                <a 
                  href={`mailto:${email}`} 
                  className="hover:text-blue-400 transition-colors truncate text-content-secondary font-medium"
                >
                  {email}
                </a>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 min-w-0">
                <Phone className="w-3.5 h-3.5 text-content-faint shrink-0" />
                <a 
                  href={`tel:${phone}`} 
                  className="hover:text-blue-400 transition-colors text-content-secondary font-medium"
                >
                  {phone}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Panel */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          {/* Detail Trigger */}
          <button
            onClick={() => onSelectCandidate(cand)}
            className="px-2.5 py-1.5 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-850 text-[10px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer transition-all shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Profile</span>
          </button>

          {/* Pipeline transitions */}
          <div className="flex gap-1.5 justify-end w-full">
            {/* Move to Shortlisted */}
            {!isSelected && (
              <button
                onClick={() => handleUpdateStatus(cand, 'Shortlisted')}
                title="Select / Shortlist Candidate"
                className="w-8 h-8 rounded-md border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
              </button>
            )}

            {/* Reject Candidate */}
            {!isRejected && (
              <button
                onClick={() => handleUpdateStatus(cand, 'Rejected')}
                title="Reject Candidate"
                className="w-8 h-8 rounded-md border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Demote/Reset to Applied */}
            {!isPending && (
              <button
                onClick={() => handleUpdateStatus(cand, 'Applied')}
                title="Reset to Pending"
                className="w-8 h-8 rounded-md border border-slate-850 bg-slate-900 hover:bg-slate-850 text-slate-400 flex items-center justify-center cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Column 1: Pending */}
      <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#0d1326] flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 text-left">
          <div className="flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-blue-400 shrink-0" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Applied / Pending</h4>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 font-mono">
            {pendingCandidates.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-1">
          {pendingCandidates.map(renderCandidateCard)}
          {pendingCandidates.length === 0 && (
            <div className="h-full flex items-center justify-center py-20 text-center text-xs text-content-muted italic">
              No pending candidates.
            </div>
          )}
        </div>
      </div>

      {/* Column 2: Selected */}
      <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#0d1326] flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 text-left">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Selected / Shortlist</h4>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 font-mono">
            {selectedCandidates.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-1">
          {selectedCandidates.map(renderCandidateCard)}
          {selectedCandidates.length === 0 && (
            <div className="h-full flex items-center justify-center py-20 text-center text-xs text-content-muted italic">
              No selected candidates.
            </div>
          )}
        </div>
      </div>

      {/* Column 3: Rejected */}
      <div className="lg:col-span-4 p-5 rounded-xl border border-slate-800 bg-[#0d1326] flex flex-col min-h-[500px]">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 text-left">
          <div className="flex items-center gap-2">
            <XCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Rejected</h4>
          </div>
          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold text-slate-300 font-mono">
            {rejectedCandidates.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 max-h-[600px] pr-1">
          {rejectedCandidates.map(renderCandidateCard)}
          {rejectedCandidates.length === 0 && (
            <div className="h-full flex items-center justify-center py-20 text-center text-xs text-content-muted italic">
              No rejected candidates.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

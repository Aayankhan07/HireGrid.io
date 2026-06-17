"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, Plus, FileText, Trash2, Sliders, Briefcase, GraduationCap, MapPin, Globe, CheckSquare } from 'lucide-react';

interface NewScreeningFormProps {
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isLoading: boolean;
}

export default function NewScreeningForm({
  onClose,
  onSubmit,
  isLoading
}: NewScreeningFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [requiredSkills, setRequiredSkills] = useState('');
  const [requiredExperienceYears, setRequiredExperienceYears] = useState(2);
  const [requiredEducation, setRequiredEducation] = useState('Bachelor');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [preferredLanguages, setPreferredLanguages] = useState('');
  const [requiredCertifications, setRequiredCertifications] = useState('');
  const [topNCandidates, setTopNCandidates] = useState(10);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        file => file.type === "application/pdf"
      );
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files).filter(
        file => file.type === "application/pdf"
      );
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      alert("Please upload at least one PDF resume.");
      return;
    }

    const data = new FormData();
    data.append("job_title", jobTitle);
    data.append("job_description", jobDescription);
    data.append("required_skills", requiredSkills);
    data.append("required_experience_years", requiredExperienceYears.toString());
    data.append("required_education", requiredEducation);
    data.append("preferred_location", preferredLocation);
    data.append("preferred_languages", preferredLanguages);
    data.append("required_certifications", requiredCertifications);
    data.append("top_n_candidates", topNCandidates.toString());
    
    files.forEach(file => {
      data.append("resumes", file);
    });

    onSubmit(data);
  };

  return (
    <div className="fixed inset-0 bg-[#060913]/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-xl relative overflow-hidden animate-slide-up my-8 border border-slate-800 bg-[#0d1326] shadow-2xl">
        
        {/* Border Accent Line */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" />
        
        {/* Form Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3 text-left">
            <div className="w-9 h-9 rounded-md bg-slate-900 flex items-center justify-center border border-slate-800 text-blue-450">
              <Sliders className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">New Candidate Screening</h2>
              <p className="text-xs text-slate-450 mt-1">Configure matching parameters and upload target resumes.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left side parameters */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Job Designation / Title</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Briefcase className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Front End Engineer"
                    className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Required Core Skills (Comma-separated)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <CheckSquare className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={requiredSkills}
                    onChange={(e) => setRequiredSkills(e.target.value)}
                    placeholder="React, TypeScript, Next.js, TailwindCSS"
                    className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Min Experience (Years)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="30"
                    value={requiredExperienceYears}
                    onChange={(e) => setRequiredExperienceYears(parseInt(e.target.value) || 0)}
                    className="glass-input w-full py-2.5 px-4 text-sm text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Education Minimum</label>
                  <div className="relative">
                    <select
                      value={requiredEducation}
                      onChange={(e) => setRequiredEducation(e.target.value)}
                      className="glass-input w-full py-2.5 px-4 text-sm appearance-none cursor-pointer bg-[#080c18] border border-slate-800 text-slate-350"
                    >
                      <option value="Any">Any Education</option>
                      <option value="Bachelor">Bachelor Degree</option>
                      <option value="Master">Master Degree</option>
                      <option value="PhD">PhD / Doctorate</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Preferred Location</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={preferredLocation}
                      onChange={(e) => setPreferredLocation(e.target.value)}
                      placeholder="e.g. Remote, Lahore"
                      className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Languages Spoken</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                      <Globe className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={preferredLanguages}
                      onChange={(e) => setPreferredLanguages(e.target.value)}
                      placeholder="e.g. English, Urdu"
                      className="glass-input w-full py-2.5 pl-10 pr-4 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Required Certifications (Optional)</label>
                <input
                  type="text"
                  value={requiredCertifications}
                  onChange={(e) => setRequiredCertifications(e.target.value)}
                  placeholder="e.g. AWS Certified Developer, Scrum Master"
                  className="glass-input w-full py-2.5 px-4 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Job Description & Core Context</label>
                <textarea
                  required
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Describe the job role, candidate expectations, day-to-day requirements, and technology expectations..."
                  className="glass-input w-full p-4 text-sm resize-none"
                />
              </div>
            </div>

            {/* Right side file upload drag boxes */}
            <div className="flex flex-col h-full space-y-4">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">Candidate Resumes (PDF format)</label>
              
              {/* Drag/Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 min-h-[160px] border border-dashed rounded-lg flex flex-col items-center justify-center p-6 text-center transition-all cursor-pointer ${
                  isDragActive 
                    ? 'border-blue-500 bg-blue-600/10' 
                    : 'border-slate-800 hover:border-slate-700 bg-[#080c18] hover:bg-[#0c142c]'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-lg bg-[#060913] flex items-center justify-center mb-3 border border-slate-850">
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-white">Click or drag PDF resumes here</p>
                <p className="text-xs text-slate-500 mt-1">Upload multiple resume PDFs to rank simultaneously</p>
              </div>

              {/* Uploaded File List */}
              <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                {files.length === 0 ? (
                  <p className="text-center text-xs text-slate-600 py-6 italic border border-slate-800 rounded-lg bg-[#080c18]/40">
                    No resumes selected.
                  </p>
                ) : (
                  files.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-[#080c18]/80"
                    >
                      <div className="flex items-center gap-3 min-w-0 text-left">
                        <div className="w-8 h-8 rounded bg-slate-900 border border-slate-850 flex items-center justify-center text-blue-450 shrink-0">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-350 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                           removeFile(idx);
                        }}
                        className="p-1 rounded-md text-slate-500 hover:text-red-450 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Max Ranked Output</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={topNCandidates}
                  onChange={(e) => setTopNCandidates(parseInt(e.target.value) || 10)}
                  className="glass-input w-full py-2 px-4 text-xs text-center"
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg border border-slate-800 text-slate-300 text-sm hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || files.length === 0}
              className="glass-button-primary px-7 py-2.5 rounded-lg text-sm flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-800 border-t-slate-300 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4.5 h-4.5" />
                  <span>Start Match Run</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

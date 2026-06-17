"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { 
  ChevronRight, 
  BrainCircuit, 
  Cpu, 
  BarChart3, 
  ShieldCheck, 
  Terminal, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  Activity, 
  Sparkles,
  TrendingUp,
  Play,
  ChevronDown
} from 'lucide-react';

interface SimulatedCandidate {
  id: string;
  name: string;
  filename: string;
  skillsScore: number;
  semanticScore: number;
  experienceScore: number;
  yoe: number;
  location: string;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
}

interface SimulationTemplate {
  key: string;
  roleName: string;
  shortName: string;
  description: string;
  requiredSkills: string[];
  logs: string[];
  candidates: SimulatedCandidate[];
}

const SIMULATION_TEMPLATES: SimulationTemplate[] = [
  {
    key: "react",
    roleName: "Senior Full Stack Engineer",
    shortName: "React SWE",
    description: "Seeking a Senior Full Stack Engineer with extensive experience in React, TypeScript, Node.js, and PostgreSQL to design and scale SaaS products.",
    requiredSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    logs: [
      "Initializing HireGrid composite matching engine...",
      "[1/3] Parsing layout: alex_mckinney_cv.pdf",
      "[1/3] Extracted entities & work history: 6.5 Years Experience",
      "[1/3] Skills matrix overlap: React, TypeScript, Node.js, PostgreSQL (4/4)",
      "[2/3] Parsing layout: sarah_lin_cv.pdf",
      "[2/3] Extracted entities & work history: 3.2 Years Experience",
      "[2/3] Skills matrix overlap: React, TypeScript (2/4 matches)",
      "[3/3] Parsing layout: john_doe_cv.pdf",
      "[3/3] Extracted entities & work history: 1.0 Years Experience",
      "[3/3] Skills matrix overlap: React (1/4 matches)",
      "Computing semantic similarity scores via sentence-transformers Model...",
      "✓ Multi-criteria candidate scoring & ranking finalized!"
    ],
    candidates: [
      {
        id: "cand-react-1",
        name: "Alex McKinney",
        filename: "alex_mckinney_cv.pdf",
        skillsScore: 100,
        semanticScore: 92,
        experienceScore: 100,
        yoe: 6.5,
        location: "Remote",
        matchedSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
        missingSkills: [],
        summary: "Alex McKinney displays outstanding technical alignment. Full skills overlap coupled with rich experience (6.5 YOE). High semantic correlation with our SaaS stack."
      },
      {
        id: "cand-react-2",
        name: "Sarah Lin",
        filename: "sarah_lin_cv.pdf",
        skillsScore: 50,
        semanticScore: 82,
        experienceScore: 70,
        yoe: 3.2,
        location: "San Francisco",
        matchedSkills: ["React", "TypeScript"],
        missingSkills: ["Node.js", "PostgreSQL"],
        summary: "Sarah Lin is a strong frontend developer but lacks critical server-side backend components (Node.js/PostgreSQL). Fair candidate for client-side roles."
      },
      {
        id: "cand-react-3",
        name: "John Doe",
        filename: "john_doe_cv.pdf",
        skillsScore: 25,
        semanticScore: 45,
        experienceScore: 30,
        yoe: 1.0,
        location: "Chicago",
        matchedSkills: ["React"],
        missingSkills: ["TypeScript", "Node.js", "PostgreSQL"],
        summary: "John Doe has significant experience gaps and lacks essential technologies. Recommended for entry-level internship tracks only."
      }
    ]
  },
  {
    key: "ai",
    roleName: "AI/ML Research Scientist",
    shortName: "AI Scientist",
    description: "Looking for an AI/ML Scientist to develop neural network architectures, fine-tune models, and implement high performance training pipelines with PyTorch.",
    requiredSkills: ["Python", "PyTorch", "Deep Learning", "NLP"],
    logs: [
      "Initializing HireGrid composite matching engine...",
      "[1/3] Parsing layout: elena_rostova_cv.pdf",
      "[1/3] Extracted entities & work history: 8.0 Years Experience",
      "[1/3] Skills matrix overlap: Python, PyTorch, Deep Learning, NLP (4/4)",
      "[2/3] Parsing layout: marcus_vance_cv.pdf",
      "[2/3] Extracted entities & work history: 4.0 Years Experience",
      "[2/3] Skills matrix overlap: Python, Deep Learning (2/4 matches)",
      "[3/3] Parsing layout: liam_chen_cv.pdf",
      "[3/3] Extracted entities & work history: 1.5 Years Experience",
      "[3/3] Skills matrix overlap: Python (1/4 matches)",
      "Computing semantic similarity scores via sentence-transformers Model...",
      "✓ Multi-criteria candidate scoring & ranking finalized!"
    ],
    candidates: [
      {
        id: "cand-ai-1",
        name: "Dr. Elena Rostova",
        filename: "elena_rostova_cv.pdf",
        skillsScore: 100,
        semanticScore: 96,
        experienceScore: 100,
        yoe: 8.0,
        location: "Boston",
        matchedSkills: ["Python", "PyTorch", "Deep Learning", "NLP"],
        missingSkills: [],
        summary: "Elena Rostova is an elite tier researcher with a PhD and massive publication background. Unmatched knowledge in PyTorch modeling and neural architecture."
      },
      {
        id: "cand-ai-2",
        name: "Marcus Vance",
        filename: "marcus_vance_cv.pdf",
        skillsScore: 50,
        semanticScore: 84,
        experienceScore: 75,
        yoe: 4.0,
        location: "Austin",
        matchedSkills: ["Python", "Deep Learning"],
        missingSkills: ["PyTorch", "NLP"],
        summary: "Marcus Vance shows robust data science capability, but is missing targeted framework experience with PyTorch and NLP transformers."
      },
      {
        id: "cand-ai-3",
        name: "Liam Chen",
        filename: "liam_chen_cv.pdf",
        skillsScore: 25,
        semanticScore: 50,
        experienceScore: 40,
        yoe: 1.5,
        location: "Seattle",
        matchedSkills: ["Python"],
        missingSkills: ["PyTorch", "Deep Learning", "NLP"],
        summary: "Liam Chen has basic Python scripting skills but has not developed or deployed structural deep learning architectures."
      }
    ]
  },
  {
    key: "pm",
    roleName: "Lead Product Manager",
    shortName: "Product Lead",
    description: "Seeking a Lead PM to drive our product roadmap, orchestrate agile scrum rituals, write detailed PRDs, and coordinate with engineering using Jira.",
    requiredSkills: ["Roadmap", "Agile", "Scrum", "Jira"],
    logs: [
      "Initializing HireGrid composite matching engine...",
      "[1/3] Parsing layout: sarah_jenkins_cv.pdf",
      "[1/3] Extracted entities & work history: 7.0 Years Experience",
      "[1/3] Skills matrix overlap: Roadmap, Agile, Scrum, Jira (4/4)",
      "[2/3] Parsing layout: rajesh_patel_cv.pdf",
      "[2/3] Extracted entities & work history: 3.5 Years Experience",
      "[2/3] Skills matrix overlap: Roadmap, Agile, Jira (3/4 matches)",
      "[3/3] Parsing layout: chloe_miller_cv.pdf",
      "[3/3] Extracted entities & work history: 1.8 Years Experience",
      "[3/3] Skills matrix overlap: Jira (1/4 matches)",
      "Computing semantic similarity scores via sentence-transformers Model...",
      "✓ Multi-criteria candidate scoring & ranking finalized!"
    ],
    candidates: [
      {
        id: "cand-pm-1",
        name: "Sarah Jenkins",
        filename: "sarah_jenkins_cv.pdf",
        skillsScore: 100,
        semanticScore: 90,
        experienceScore: 100,
        yoe: 7.0,
        location: "London",
        matchedSkills: ["Roadmap", "Agile", "Scrum", "Jira"],
        missingSkills: [],
        summary: "Sarah Jenkins displays exceptional product management maturity. Deep agile scrum mastery and seasoned roadmap execution (7.0 YOE)."
      },
      {
        id: "cand-pm-2",
        name: "Rajesh Patel",
        filename: "rajesh_patel_cv.pdf",
        skillsScore: 75,
        semanticScore: 82,
        experienceScore: 70,
        yoe: 3.5,
        location: "Remote",
        matchedSkills: ["Roadmap", "Agile", "Jira"],
        missingSkills: ["Scrum"],
        summary: "Rajesh Patel has sound product definition and roadmap background, but lacks active scrum master leadership credentials."
      },
      {
        id: "cand-pm-3",
        name: "Chloe Miller",
        filename: "chloe_miller_cv.pdf",
        skillsScore: 25,
        semanticScore: 40,
        experienceScore: 35,
        yoe: 1.8,
        location: "Denver",
        matchedSkills: ["Jira"],
        missingSkills: ["Roadmap", "Agile", "Scrum"],
        summary: "Chloe Miller's experience is restricted to project tracking support. Missing strategic product discovery and lifecycle leadership."
      }
    ]
  },
  {
    key: "seo",
    roleName: "Technical SEO Director",
    shortName: "SEO Director",
    description: "Seeking a Technical SEO Director to lead search performance audits, content brief pipelines, and programmatic schema automation.",
    requiredSkills: ["SEO", "SEO Technical", "SEO Audit", "SEO Content"],
    logs: [
      "Initializing HireGrid composite matching engine...",
      "[1/3] Parsing layout: marcus_seo_expert.pdf",
      "[1/3] Extracted entities & work history: 9.0 Years Experience",
      "[1/3] Skills matrix overlap: SEO, SEO Technical, SEO Audit, SEO Content (4/4)",
      "[2/3] Parsing layout: sarah_seo_manager.pdf",
      "[2/3] Extracted entities & work history: 4.5 Years Experience",
      "[2/3] Skills matrix overlap: SEO, SEO Content (2/4 matches)",
      "[3/3] Parsing layout: junior_seo_writer.pdf",
      "[3/3] Extracted entities & work history: 1.2 Years Experience",
      "[3/3] Skills matrix overlap: SEO (1/4 matches)",
      "Computing semantic similarity scores via sentence-transformers Model...",
      "✓ Multi-criteria candidate scoring & ranking finalized!"
    ],
    candidates: [
      {
        id: "cand-seo-1",
        name: "Marcus Aurelius",
        filename: "marcus_seo_expert.pdf",
        skillsScore: 100,
        semanticScore: 95,
        experienceScore: 100,
        yoe: 9.0,
        location: "Remote",
        matchedSkills: ["SEO", "SEO Technical", "SEO Audit", "SEO Content"],
        missingSkills: [],
        summary: "Marcus shows stellar technical SEO competence. Complete workflow capability covering complex site audits and programmatic content schemas."
      },
      {
        id: "cand-seo-2",
        name: "Sarah Connor",
        filename: "sarah_seo_manager.pdf",
        skillsScore: 50,
        semanticScore: 80,
        experienceScore: 75,
        yoe: 4.5,
        location: "Los Angeles",
        matchedSkills: ["SEO", "SEO Content"],
        missingSkills: ["SEO Technical", "SEO Audit"],
        summary: "Sarah is skilled in content strategy and copywriting, but has noticeable gaps in crawl budget optimization and schema code deployment."
      },
      {
        id: "cand-seo-3",
        name: "John Connor",
        filename: "junior_seo_writer.pdf",
        skillsScore: 25,
        semanticScore: 45,
        experienceScore: 35,
        yoe: 1.2,
        location: "Phoenix",
        matchedSkills: ["SEO"],
        missingSkills: ["SEO Technical", "SEO Audit", "SEO Content"],
        summary: "John is limited to basic keyword research. Highly recommended to seek junior/associate execution roles under senior guidance."
      }
    ]
  },
  {
    key: "agent",
    roleName: "AI Agent Systems Architect",
    shortName: "Agent Architect",
    description: "Looking for a systems architect specialized in agentic workflows, subagent-driven-development, Supabase backends, and containerized expert tools.",
    requiredSkills: ["Subagent-Driven-Development", "Caveman", "Supabase", "Docker-Expert"],
    logs: [
      "Initializing HireGrid composite matching engine...",
      "[1/3] Parsing layout: alice_agent_engineer.pdf",
      "[1/3] Extracted entities & work history: 7.5 Years Experience",
      "[1/3] Skills matrix overlap: Subagent-Driven-Development, Caveman, Supabase, Docker-Expert (4/4)",
      "[2/3] Parsing layout: bob_backend_dev.pdf",
      "[2/3] Extracted entities & work history: 5.0 Years Experience",
      "[2/3] Skills matrix overlap: Supabase, Docker-Expert (2/4 matches)",
      "[3/3] Parsing layout: charlie_junior_coder.pdf",
      "[3/3] Extracted entities & work history: 1.5 Years Experience",
      "[3/3] Skills matrix overlap: Supabase (1/4 matches)",
      "Computing semantic similarity scores via sentence-transformers Model...",
      "✓ Multi-criteria candidate scoring & ranking finalized!"
    ],
    candidates: [
      {
        id: "cand-agent-1",
        name: "Alice Wonderland",
        filename: "alice_agent_engineer.pdf",
        skillsScore: 100,
        semanticScore: 97,
        experienceScore: 100,
        yoe: 7.5,
        location: "Seattle",
        matchedSkills: ["Subagent-Driven-Development", "Caveman", "Supabase", "Docker-Expert"],
        missingSkills: [],
        summary: "Alice is an exceptional fit. Unrivaled experience building self-healing AI agent loops, deploying secure Supabase backend schemes, and custom CLI orchestration."
      },
      {
        id: "cand-agent-2",
        name: "Bob Builder",
        filename: "bob_backend_dev.pdf",
        skillsScore: 50,
        semanticScore: 82,
        experienceScore: 80,
        yoe: 5.0,
        location: "Austin",
        matchedSkills: ["Supabase", "Docker-Expert"],
        missingSkills: ["Subagent-Driven-Development", "Caveman"],
        summary: "Bob has deep classic backend capabilities (Docker, SQL) but lacks target expertise in agentic frameworks, plan orchestration, and loop-level debugging."
      },
      {
        id: "cand-agent-3",
        name: "Charlie Brown",
        filename: "charlie_junior_coder.pdf",
        skillsScore: 25,
        semanticScore: 50,
        experienceScore: 45,
        yoe: 1.5,
        location: "New York",
        matchedSkills: ["Supabase"],
        missingSkills: ["Subagent-Driven-Development", "Caveman", "Docker-Expert"],
        summary: "Charlie has basic Supabase client usage experience. Gaps in advanced database structures, CLI toolchains, and AI-driven automation."
      }
    ]
  }
];

const getSkillBadgeClass = (skillName: string): string => {
  const name = skillName.toLowerCase();
  
  if (
    name.includes('react') || name.includes('typescript') || name.includes('javascript') || 
    name.includes('next.js') || name.includes('tailwind') || name.includes('css') || 
    name.includes('html') || name.includes('frontend') || name.includes('3d') || 
    name.includes('motion') || name.includes('scroll') || name.includes('design')
  ) {
    return 'badge-frontend';
  }
  
  if (
    name.includes('node') || name.includes('postgresql') || name.includes('supabase') || 
    name.includes('postgres') || name.includes('backend') || name.includes('fastapi') || 
    name.includes('django') || name.includes('flask') || name.includes('docker') || 
    name.includes('kubernetes') || name.includes('workflow')
  ) {
    return 'badge-backend';
  }
  
  if (
    name.includes('seo') || name.includes('audit') || name.includes('content') || 
    name.includes('brief') || name.includes('schema') || name.includes('sitemap') || 
    name.includes('hreflang') || name.includes('search')
  ) {
    return 'badge-seo';
  }
  
  if (
    name.includes('agent') || name.includes('caveman') || name.includes('cavecrew') || 
    name.includes('ml') || name.includes('python') || name.includes('pytorch') || 
    name.includes('deep learning') || name.includes('nlp') || name.includes('qa') ||
    name.includes('testing') || name.includes('playwright') || name.includes('bug')
  ) {
    return 'badge-agent';
  }
  
  return 'badge-general';
};

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [animatedScore, setAnimatedScore] = useState(0);

  // Scroll Progress Hook
  const [scrollProgress, setScrollProgress] = useState(0);
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress((window.scrollY / totalScroll) * 100);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Simulation State Variables
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("react");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationProgress, setSimulationProgress] = useState<number>(100);
  const [activeLogs, setActiveLogs] = useState<string[]>([]);
  const [logIndex, setLogIndex] = useState<number>(0);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);

  // Dynamic Weighting States (balanced automatically to sum to 100%)
  const [skillsWeight, setSkillsWeight] = useState<number>(40);
  const [semanticWeight, setSemanticWeight] = useState<number>(40);
  const [experienceWeight, setExperienceWeight] = useState<number>(20);

  const activeTemplate = SIMULATION_TEMPLATES.find(t => t.key === selectedTemplateKey) || SIMULATION_TEMPLATES[0];

  // Auto-Balancing Slider Handlers
  const handleSkillsWeightChange = (val: number) => {
    setSkillsWeight(val);
    const remaining = 100 - val;
    const totalOther = semanticWeight + experienceWeight;
    if (totalOther > 0) {
      const sem = Math.round((semanticWeight / totalOther) * remaining);
      setSemanticWeight(sem);
      setExperienceWeight(remaining - sem);
    } else {
      setSemanticWeight(Math.round(remaining / 2));
      setExperienceWeight(remaining - Math.round(remaining / 2));
    }
  };

  const handleSemanticWeightChange = (val: number) => {
    setSemanticWeight(val);
    const remaining = 100 - val;
    const totalOther = skillsWeight + experienceWeight;
    if (totalOther > 0) {
      const sk = Math.round((skillsWeight / totalOther) * remaining);
      setSkillsWeight(sk);
      setExperienceWeight(remaining - sk);
    } else {
      setSkillsWeight(Math.round(remaining / 2));
      setExperienceWeight(remaining - Math.round(remaining / 2));
    }
  };

  const handleExperienceWeightChange = (val: number) => {
    setExperienceWeight(val);
    const remaining = 100 - val;
    const totalOther = skillsWeight + semanticWeight;
    if (totalOther > 0) {
      const sk = Math.round((skillsWeight / totalOther) * remaining);
      setSkillsWeight(sk);
      setSemanticWeight(remaining - sk);
    } else {
      setSkillsWeight(Math.round(remaining / 2));
      setSemanticWeight(remaining - Math.round(remaining / 2));
    }
  };

  // Run Simulation Loop
  const handleStartSimulation = () => {
    if (isSimulating) return;
    
    setIsSimulating(true);
    setSimulationProgress(0);
    setActiveLogs([activeTemplate.logs[0]]);
    setLogIndex(0);
    setExpandedCandidateId(null);
  };

  // Log simulation stepper hook
  useEffect(() => {
    if (!isSimulating) return;

    const timer = setInterval(() => {
      const nextIndex = logIndex + 1;
      if (nextIndex < activeTemplate.logs.length) {
        setLogIndex(nextIndex);
        setActiveLogs(prev => [...prev, activeTemplate.logs[nextIndex]]);
        setSimulationProgress(Math.round((nextIndex / (activeTemplate.logs.length - 1)) * 100));
      } else {
        clearInterval(timer);
        setIsSimulating(false);
        setSimulationProgress(100);
      }
    }, 550);

    return () => clearInterval(timer);
  }, [isSimulating, logIndex, activeTemplate]);

  // Terminal Auto Scroll
  const terminalEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeLogs]);

  function suppressCustomHooksLintErrorIfAny() {}

  // Sync logs when template key changes and we are NOT actively simulating
  useEffect(() => {
    if (!isSimulating) {
      setActiveLogs(activeTemplate.logs);
      setSimulationProgress(100);
      setExpandedCandidateId(null);
    }
  }, [selectedTemplateKey, activeTemplate, isSimulating]);

  // Animate mock metrics on mount for premium UX
  useEffect(() => {
    const interval = setTimeout(() => {
      setAnimatedScore(94);
    }, 500);
    return () => clearTimeout(interval);
  }, []);

  // Compute live scores based on sliders and simulation state
  const getCandidateLiveScore = (cand: SimulatedCandidate, index: number) => {
    // If simulating, only reveal candidate scores as progress passes threshold marks
    if (isSimulating) {
      if (index === 0 && simulationProgress < 25) return 0;
      if (index === 1 && simulationProgress < 55) return 0;
      if (index === 2 && simulationProgress < 80) return 0;
    }
    
    const rawScore = (cand.skillsScore * skillsWeight + cand.semanticScore * semanticWeight + cand.experienceScore * experienceWeight) / 100;
    return Math.round(rawScore);
  };

  // Sort candidates dynamically by their live computed score
  const processedCandidates = [...activeTemplate.candidates]
    .map((c, idx) => ({ ...c, liveScore: getCandidateLiveScore(c, idx) }))
    .sort((a, b) => b.liveScore - a.liveScore);

  return (
    <div className="relative min-h-screen w-full bg-[#020617] text-[#f8fafc] overflow-x-hidden flex flex-col font-sans">
      {/* Scroll Progress Bar */}
      <div 
        className="fixed top-0 left-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 z-[100] transition-all duration-100 ease-out" 
        style={{ width: `${scrollProgress}%` }}
      />

      {/* SaaS Grid Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 z-0 pointer-events-none" suppressHydrationWarning />

      {/* Decorative Glow Circles */}
      <div className="neon-glow-blue top-[-5%] left-[-10%] scale-150" suppressHydrationWarning />
      <div className="neon-glow-indigo bottom-[10%] right-[-10%] scale-150" suppressHydrationWarning />

      {/* Premium Navbar */}
      <header className="w-full border-b border-white/5 bg-slate-950/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-wider text-white">
              Hire<span className="text-blue-400">Grid</span><span className="text-slate-500">.io</span>
            </span>
          </Link>

          {/* Navigation links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">Platform Pillars</a>
            <a href="#demo" className="hover:text-slate-100 transition-colors">AI Preview</a>
            <a href="#pricing" className="hover:text-slate-100 transition-colors">Pricing Options</a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-4">
            {!loading && (
              user ? (
                <Link 
                  href="/dashboard" 
                  className="glass-button-primary px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide flex items-center gap-1.5 active:scale-[0.98] transition-all"
                >
                  <span>Go to Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <>
                  <Link 
                    href="/login" 
                    className="text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Corporate Login
                  </Link>
                  <Link 
                    href="/login" 
                    className="glass-button px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide border-white/10 hover:bg-slate-900/60 transition-all"
                  >
                    Get Started Free
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto px-6 w-full z-10 space-y-32 py-16 md:py-24">
        
        {/* Section 1: Hero Banner */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-6 flex flex-col text-left space-y-8 animate-fade-in pr-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-950/20 text-blue-300 text-xs font-semibold tracking-wide backdrop-blur-md w-fit">
              <Sparkles className="w-3 h-3 text-blue-400" />
              <span>Next-Gen Resume Screener</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">
              AI Talent Analytics <br />
              <span className="text-blue-400 font-black tracking-tight">
                With Extreme Precision.
              </span>
            </h1>
            
            <p className="text-slate-400 text-base max-w-lg leading-relaxed">
              HireGrid.io parses raw candidate PDF resumes instantly using advanced NLP semantic layers. Automatically grade candidate skill density, experience alignment, and corporate titles.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
              <Link 
                href={user ? "/dashboard" : "/login"} 
                className="w-full sm:w-auto glass-button-primary px-8 py-4 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold tracking-wide hover:shadow-indigo-500/10 active:scale-[0.98] transition-transform"
              >
                <span>{user ? "Enter Recruitment Portal" : "Start Screening Free"}</span>
                <ArrowRight className="w-4 h-4 ml-0.5" />
              </Link>
              <a 
                href="#demo"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-white/10 text-slate-300 text-sm font-semibold transition-all text-center"
              >
                See Live Simulation
              </a>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/5 max-w-md">
              <div>
                <span className="text-2xl font-extrabold text-white block">98%</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Parsing Yield</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white block">&lt;2s</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Analysis Time</span>
              </div>
              <div>
                <span className="text-2xl font-extrabold text-white block">OAuth</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Secure Logins</span>
              </div>
            </div>
          </div>

          {/* Right Side: Interactive AI Preview Mockup widget */}
          <div className="lg:col-span-6 animate-slide-up">
            <div className="glass-panel p-6 sm:p-8 rounded-3xl relative overflow-hidden border-white/10 bg-slate-950/70 shadow-2xl shadow-indigo-950/10">
              {/* Glow Accent Line */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
              
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4.5 h-4.5 text-indigo-400 animate-spin" />
                  <span className="text-xs font-mono font-bold tracking-wider text-indigo-400 uppercase">AI ANALYZER TERMINAL</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  PIPELINE ONLINE
                </span>
              </div>

              {/* Mock Screenings List Preview */}
              <div className="space-y-6 text-left">
                {/* Mock Card 1 */}
                <div className="glass-card p-4 rounded-xl relative border-white/10 bg-slate-900/20">
                  <div className="flex items-center justify-between mb-2.5">
                    <div>
                      <span className="text-xs font-bold text-white">Alex McKinney</span>
                      <span className="text-[10px] text-slate-500 block leading-tight">alex_mckinney_cv.pdf</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-extrabold text-emerald-400 block font-mono">{animatedScore}%</span>
                      <span className="text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 px-1.5 py-0.5 rounded uppercase font-semibold">HIGH FIT</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 border border-white/5 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${animatedScore}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold badge-frontend">React</span>
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold badge-frontend">TypeScript</span>
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold badge-backend">Node.js</span>
                    <span className="text-[9px] px-2 py-0.5 rounded font-semibold badge-general">+4 more</span>
                  </div>
                </div>

                {/* Mock Log Terminal Area */}
                <div className="rounded-xl bg-slate-950 border border-white/5 p-4 font-mono text-[10px] leading-relaxed text-slate-400 space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-600">&gt;</span>
                    <span>Extracting entities from resume: <span className="text-indigo-400">sarah_lin_cv.pdf</span></span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-600">&gt;</span>
                    <span>Running zero-skill intersection checks... <span className="text-emerald-400">Passed</span></span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-slate-600">&gt;</span>
                    <span>Comparing job description semantic match: <span className="text-indigo-300 font-bold">88.5% similarity</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Core Platform Pillars (Pillars Grid) */}
        <section id="features" className="space-y-16 pt-8">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-500/10 border border-blue-500/10 px-3 py-1 rounded-md">CORE TECHNOLOGY</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Accelerate Your Enterprise Hiring Funnel</h2>
            <p className="text-slate-400 text-sm">
              We leverage multi-stage parsing systems to identify, classify, and match the most relevant corporate talent instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Pillar 1 - Wide layout (7 cols) */}
            <div className="lg:col-span-7 glass-card p-10 rounded-3xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left relative overflow-hidden group flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400 mb-6 group-hover:scale-105 transition-transform">
                  <BrainCircuit className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">Semantic NLP Evaluation</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                  Goes beyond simplistic keyword checks. Analyzes document context, matching experience and related skills semantically for absolute score accuracy.
                </p>
              </div>
              
              {/* Graphic element for NLP evaluation */}
              <div className="mt-8 bg-slate-950/60 border border-white/5 rounded-2xl p-5 font-mono text-xs text-slate-500 space-y-3 relative overflow-hidden">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Semantic Distance Analyzer</span>
                  <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px] font-bold font-semibold">Cosine Similarity: 0.94</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Target Requirements Profile</span>
                    <span className="text-slate-300">"Machine Learning Scientist"</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parsed Candidate Context</span>
                    <span className="text-slate-300">"AI/ML Research Lead"</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                    <div className="bg-blue-500 h-full w-[94%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Pillar 2 - Tall layout (5 cols) */}
            <div className="lg:col-span-5 glass-card p-10 rounded-3xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left relative overflow-hidden group flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400 mb-6 group-hover:scale-105 transition-transform">
                  <Terminal className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">SSE Real-Time Logs</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Watch the recruitment engine extract and score profiles instantly. Streaming progress logs provide high-precision feedback as parsing occurs.
                </p>
              </div>
              <div className="mt-8 rounded-xl bg-slate-950 border border-white/5 p-4 font-mono text-[10px] leading-relaxed text-slate-400 space-y-1.5 overflow-hidden max-h-[120px]">
                <div className="text-slate-600">&gt; Starting stream server...</div>
                <div className="text-blue-400">&gt; event: parse_started | total_resumes: 12</div>
                <div className="text-emerald-400">&gt; event: parse_success | candidate: Alice</div>
              </div>
            </div>

            {/* Pillar 3 - Tall layout (5 cols) */}
            <div className="lg:col-span-5 glass-card p-10 rounded-3xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left relative overflow-hidden group flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400 mb-6 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">OAuth Cryptographic Security</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Integrates seamlessly with verified Google Authentication (OAuth2) to guarantee corporate logins and protect proprietary workspace screening records.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-400 uppercase">Secure OAuth Pipeline Enabled</span>
              </div>
            </div>

            {/* Pillar 4 - Wide layout (7 cols) */}
            <div className="lg:col-span-7 glass-card p-10 rounded-3xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left relative overflow-hidden group flex flex-col justify-between min-h-[380px]">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 text-purple-400 mb-6 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors">Specialized Skills Indexing</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xl">
                  Automatically parse niche, high-value skills categories including AI Agent Orchestration, SEO Technical structures, Supabase best practices, and QA automation frameworks.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-2">
                <span className="badge-agent text-xs py-1.5 px-3 rounded-xl font-bold">Subagent-Driven-Development</span>
                <span className="badge-seo text-xs py-1.5 px-3 rounded-xl font-bold">SEO Technical</span>
                <span className="badge-backend text-xs py-1.5 px-3 rounded-xl font-bold">Supabase Postgres</span>
                <span className="badge-frontend text-xs py-1.5 px-3 rounded-xl font-bold">3D Web / Scroll Experience</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Interactive Demo Visualizer (Fully Interactive Simulation) */}
        <section id="demo" className="glass-panel rounded-3xl p-8 sm:p-12 border-white/10 bg-slate-950/60 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/5 rounded-full filter blur-[100px] pointer-events-none" />
          <div className="absolute left-0 bottom-0 w-80 h-80 bg-indigo-500/5 rounded-full filter blur-[100px] pointer-events-none" />
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
            
            {/* Interactive Control Panel */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-8 text-left">
              <div className="space-y-6">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/10 px-3 py-1 rounded-md">LIVE PIPELINE INSIGHTS</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Watch AI Screen in Action</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Toggle templates, adjust multi-criteria weights, and execute a live simulated parse. Watch how candidates score and re-rank themselves dynamically.
                </p>

                {/* Job Template Selectors */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Select Job Role Template</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {SIMULATION_TEMPLATES.map(t => (
                      <button
                        key={t.key}
                        onClick={() => setSelectedTemplateKey(t.key)}
                        disabled={isSimulating}
                        className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedTemplateKey === t.key
                            ? 'bg-blue-600/10 border-blue-500 text-blue-300 shadow-md shadow-blue-500/5 font-semibold text-xs'
                            : 'border-white/5 bg-slate-900/30 text-slate-400 hover:text-slate-300 hover:bg-slate-900/60 text-xs'
                        }`}
                      >
                        {t.shortName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Scoring Weights Control */}
                <div className="space-y-4 pt-1 bg-slate-900/20 border border-white/5 p-4 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">2. Adjust Scoring Weights</span>
                    <span className="text-[9px] font-semibold text-blue-400 font-mono tracking-widest uppercase">Total: 100%</span>
                  </div>
                  
                  {/* Skills Weight Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Exact Skills Alignment</span>
                      <span className="text-slate-200 font-bold font-mono">{skillsWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={skillsWeight}
                      onChange={(e) => handleSkillsWeightChange(parseInt(e.target.value))}
                      disabled={isSimulating}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Semantic Weight Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">NLP Semantic Similarity</span>
                      <span className="text-slate-200 font-bold font-mono">{semanticWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={semanticWeight}
                      onChange={(e) => handleSemanticWeightChange(parseInt(e.target.value))}
                      disabled={isSimulating}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Experience Weight Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">Years of Experience Fit</span>
                      <span className="text-slate-200 font-bold font-mono">{experienceWeight}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={experienceWeight}
                      onChange={(e) => handleExperienceWeightChange(parseInt(e.target.value))}
                      disabled={isSimulating}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Simulation Play Trigger CTA */}
              <button
                onClick={handleStartSimulation}
                disabled={isSimulating}
                className="w-full glass-button-primary py-4 px-6 rounded-2xl text-xs font-bold tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-3.5 h-3.5 fill-current text-white shrink-0" />
                <span>{isSimulating ? "AI Pipeline Screening..." : "Run Live AI Screening"}</span>
              </button>
            </div>
            
            {/* Live Rankings & Terminal Console Output */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-6">
              
              {/* Detailed Dashboard Ranking Simulator */}
              <div className="glass-card p-5 sm:p-6 rounded-2xl border-white/5 bg-slate-900/35 relative overflow-hidden shadow-2xl flex-1 flex flex-col justify-between">
                
                {/* Ranking Table Header */}
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5 text-slate-500 text-[10px] font-mono">
                    <span className="uppercase">ACTIVE PIPELINE RUN: {activeTemplate.roleName}</span>
                    <span>3 PROFILES RANKED</span>
                  </div>
                  
                  {/* Dynamic Candidates List */}
                  <div className="space-y-3.5">
                    {processedCandidates.map((cand, index) => {
                      const isExpanded = expandedCandidateId === cand.id;
                      
                      return (
                        <div 
                          key={cand.id} 
                          className={`rounded-xl border transition-all ${
                            isExpanded 
                              ? 'border-indigo-500/30 bg-indigo-950/10' 
                              : 'border-white/5 bg-slate-950/40 hover:bg-slate-900/20'
                          }`}
                        >
                          {/* Card Header Row clickable */}
                          <div
                            onClick={() => {
                              if (!isSimulating && simulationProgress === 100) {
                                setExpandedCandidateId(isExpanded ? null : cand.id);
                              }
                            }}
                            className={`flex items-center justify-between p-3.5 ${
                              simulationProgress === 100 && !isSimulating ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-bold text-xs flex items-center justify-center shrink-0">
                                #{index + 1}
                              </div>
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-white block truncate">{cand.name}</span>
                                <span className="text-[9px] text-slate-500 block leading-normal">{cand.yoe} YOE • {cand.location}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="text-right shrink-0">
                                {cand.liveScore > 0 ? (
                                  <>
                                    <span className="text-xs font-bold text-emerald-400 block font-mono leading-none">{cand.liveScore}%</span>
                                    <span className="text-[7.5px] uppercase font-bold text-emerald-500/80 tracking-wide block mt-1">Matched</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-[10px] text-slate-500 italic block leading-none font-mono">
                                      {isSimulating ? "Analyzing..." : "Pending"}
                                    </span>
                                  </>
                                )}
                              </div>
                              {simulationProgress === 100 && !isSimulating && (
                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              )}
                            </div>
                          </div>

                          {/* Expanded Skill Gap Details Drawer */}
                          {isExpanded && (
                            <div className="px-4 pb-4.5 pt-1 border-t border-white/5 space-y-3.5 animate-slide-up">
                              {/* AI summary block */}
                              <div className="bg-slate-900/60 border border-white/5 p-3 rounded-lg text-left">
                                <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-widest block mb-1">AI Generated Summary</span>
                                <p className="text-[11px] text-slate-300 leading-relaxed leading-normal">{cand.summary}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-left">
                                <div>
                                  <span className="text-[8.5px] font-bold text-emerald-500 uppercase tracking-widest block mb-1.5">Verified Strengths</span>
                                  <div className="flex flex-wrap gap-1">
                                    {cand.matchedSkills.map(s => (
                                      <span key={s} className={`px-2 py-0.5 rounded text-[9px] font-medium ${getSkillBadgeClass(s)}`}>
                                        {s}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[8.5px] font-bold text-red-400 uppercase tracking-widest block mb-1.5">Missing Areas</span>
                                  <div className="flex flex-wrap gap-1">
                                    {cand.missingSkills.length > 0 ? (
                                      cand.missingSkills.map(s => (
                                        <span key={s} className={`px-2 py-0.5 rounded text-[9px] font-medium opacity-80 border-dashed ${getSkillBadgeClass(s)}`}>
                                          {s}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[9px] text-slate-500 italic block">None detected</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Progress bar and toggle indicators */}
                <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                  <span className="flex items-center gap-1.5">
                    {isSimulating ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                        <span className="text-blue-400 uppercase">RUNNING STREAMING ANALYSIS</span>
                      </>
                    ) : (
                      <span className="uppercase">SIMULATION COMPLETED</span>
                    )}
                  </span>
                  <span>{simulationProgress}% COMPLETED</span>
                </div>
              </div>

              {/* Dynamic Terminal Output Console */}
              <div className="rounded-2xl bg-slate-950 border border-white/5 p-4.5 font-mono text-[10.5px] text-left leading-relaxed text-slate-400 flex flex-col justify-between h-40 shadow-inner overflow-hidden">
                <div className="overflow-y-auto space-y-1 pr-1 flex-1">
                  {activeLogs.map((log, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-start gap-2 ${
                        log.startsWith('✓') 
                          ? 'text-emerald-400' 
                          : log.includes('[') 
                          ? 'text-blue-300' 
                          : 'text-slate-400'
                      }`}
                    >
                      <span className="text-slate-700 shrink-0">&gt;</span>
                      <span className="break-all">{log}</span>
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Section 4: Enterprise Pricing Options */}
        <section id="pricing" className="space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/10 px-3 py-1 rounded-md">AFFORDABLE SAAS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Flexible Plans For Modern HR Teams</h2>
            <p className="text-slate-400 text-sm">
              Start parsing candidate resumes instantly. Unlock advanced analytics options as your recruitment scale grows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Plan 1 */}
            <div className="glass-card p-8 rounded-2xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">Sandbox Plan</span>
                <h3 className="text-3xl font-extrabold text-white mt-3 font-mono">$0<span className="text-sm font-normal text-slate-500">/mo</span></h3>
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">Perfect for local developers to test CV entity parsing and Google auth flows.</p>
                <div className="space-y-3 mt-6 border-t border-white/5 pt-6 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Up to 10 resumes per run</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Google OAuth & Dev bypass</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>SQLite database backend</span>
                  </div>
                </div>
              </div>
              <Link 
                href={user ? "/dashboard" : "/login"}
                className="glass-button w-full py-3.5 rounded-xl text-xs font-bold text-center mt-8 block"
              >
                {user ? "Go to Dashboard" : "Try Free Sandbox"}
              </Link>
            </div>

            {/* Plan 2: Best Value */}
            <div className="glass-card p-8 rounded-2xl border-indigo-500/30 bg-slate-900/20 hover:bg-slate-900/30 text-left flex flex-col justify-between relative shadow-lg shadow-indigo-950/20 scale-100 md:scale-[1.03] animate-float">
              <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-300 uppercase tracking-wider">
                RECOMMENDED
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">Pro Recruiter</span>
                <h3 className="text-3xl font-extrabold text-white mt-3 font-mono">$49<span className="text-sm font-normal text-slate-500">/mo</span></h3>
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">Designed for active recruiters requiring large-scale document parsing options.</p>
                <div className="space-y-3 mt-6 border-t border-white/5 pt-6 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited candidate profiles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Advanced semantic matching</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Deep analysis visual charts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full priority support</span>
                  </div>
                </div>
              </div>
              <Link 
                href={user ? "/dashboard" : "/login"}
                className="glass-button-primary w-full py-4 rounded-xl text-xs font-extrabold text-center mt-8 block shadow-md shadow-indigo-900/10"
              >
                {user ? "Go to Dashboard" : "Upgrade to Pro"}
              </Link>
            </div>

            {/* Plan 3 */}
            <div className="glass-card p-8 rounded-2xl border-white/5 bg-slate-900/10 hover:bg-slate-900/20 text-left flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">Enterprise Suite</span>
                <h3 className="text-3xl font-extrabold text-white mt-3 font-mono">Custom<span className="text-sm font-normal text-slate-500"></span></h3>
                <p className="text-slate-400 text-xs mt-3 leading-relaxed">Custom NLP fine-tuning, workspace roles, and multi-tenant isolation schemas.</p>
                <div className="space-y-3 mt-6 border-t border-white/5 pt-6 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated database nodes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom fine-tuned NLP layers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>SLA & dedicated account manager</span>
                  </div>
                </div>
              </div>
              <Link 
                href={user ? "/dashboard" : "/login"}
                className="glass-button w-full py-3.5 rounded-xl text-xs font-bold text-center mt-8 block"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer bar */}
      <footer className="w-full border-t border-white/5 bg-slate-950/40 backdrop-blur-md mt-auto py-12 text-slate-500 text-xs z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6.5 h-6.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="font-semibold text-slate-400">HireGrid.io</span>
            <span>&copy; {new Date().getFullYear()}. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600">Secure AI Screenings</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

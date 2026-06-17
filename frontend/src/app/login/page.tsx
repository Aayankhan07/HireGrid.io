"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  LogIn, 
  User, 
  Lock, 
  Mail, 
  UserPlus, 
  ShieldAlert, 
  CheckCircle2, 
  ChevronRight, 
  BrainCircuit, 
  Cpu, 
  BarChart3, 
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const { login, signup, loginWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Recruitment Lead');
  
  // Google Auth & Mock Simulator States
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const [googleSdkLoaded, setGoogleSdkLoaded] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showMockGoogleDialog, setShowMockGoogleDialog] = useState(false);
  const [customMockEmail, setCustomMockEmail] = useState('');
  const [customMockName, setCustomMockName] = useState('');
  const [useCustomMock, setUseCustomMock] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Focus states for input animations
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  
  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);

  // Dynamic Loading of Google Identity Client SDK
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleSdkLoaded(true);
      // Initialize Standard Google Identity Services if a real client ID is detected
      const isRealClient = googleClientId && 
                           !googleClientId.includes("placeholder") && 
                           !googleClientId.includes("YOUR_");
      if (isRealClient) {
        try {
          // @ts-ignore
          google.accounts.id.initialize({
            client_id: googleClientId,
            use_fedcm_for_prompt: false,
            callback: async (response: any) => {
              setError('');
              setSuccessMsg('');
              setIsGoogleLoading(true);
              try {
                await loginWithGoogle(response.credential);
              } catch (err: any) {
                setError(err.message || 'Failed to authenticate with Google account.');
                setIsGoogleLoading(false);
              }
            },
          });
        } catch (e) {
          console.warn("Failed to initialize real Google Accounts services:", e);
        }
      }
    };
    script.onerror = () => {
      console.warn("Could not load Google Accounts SDK. Falling back entirely to developer simulator.");
    };
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [googleClientId, loginWithGoogle]);

  // Hook to render live official Google Sign-In Button inside the dialog
  useEffect(() => {
    if (showMockGoogleDialog && googleClientId && googleSdkLoaded) {
      const isRealClient = googleClientId && 
                           !googleClientId.includes("placeholder") && 
                           !googleClientId.includes("YOUR_");
      if (isRealClient) {
        // Allow a microsecond delay for the modal DOM element to mount
        const timer = setTimeout(() => {
          const container = document.getElementById("google-live-btn-container");
          if (container) {
            try {
              // @ts-ignore
              google.accounts.id.renderButton(
                container,
                { 
                  theme: "filled_blue", 
                  size: "large", 
                  width: container.clientWidth || 330,
                  text: "signin_with"
                }
              );
            } catch (e) {
              console.warn("Failed to render native Google button:", e);
            }
          }
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [showMockGoogleDialog, googleClientId, googleSdkLoaded]);

  const handleGoogleSignInClick = () => {
    setError('');
    setSuccessMsg('');
    setShowMockGoogleDialog(true);
  };

  const handleMockAccountSelect = async (mockEmail: string, mockName: string) => {
    setShowMockGoogleDialog(false);
    setError('');
    setSuccessMsg('');
    setIsGoogleLoading(true);
    
    try {
      // Slugify name for token: spaces -> hyphens
      const nameSlug = mockName.trim().replace(/\s+/g, '-');
      const mockToken = `mock_google_jwt_${mockEmail.trim()}_${nameSlug}`;
      await loginWithGoogle(mockToken);
    } catch (err: any) {
      setError(err.message || 'Mock Google Authentication failed.');
      setIsGoogleLoading(false);
    }
  };

  const handleTabChange = (tab: 'signin' | 'signup') => {
    setActiveTab(tab);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setShowPassword(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!email.includes('@')) {
        setError('Please enter a valid corporate email address.');
        setLoading(false);
        return;
      }
      if (password.length < 4) {
        setError('Security password must be at least 4 characters.');
        setLoading(false);
        return;
      }

      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Invalid corporate credentials.');
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (!name.trim()) {
        setError('Please enter your full name.');
        setLoading(false);
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid corporate email address.');
        setLoading(false);
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        setLoading(false);
        return;
      }

      await signup(email, password, name, role);
      setSuccessMsg('Account registered successfully! You can now log in.');
      setActiveTab('signin');
      setPassword('');
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to register account.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#060913] px-4 py-12 md:py-24 overflow-hidden">
      {/* SaaS Grid Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0e1526_1px,transparent_1px),linear-gradient(to_bottom,#0e1526_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

      {/* Main SaaS Responsive Split Container */}
      <div className="w-full max-w-5xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center px-2">
        
        {/* Left Side: Premium Enterprise Feature Showcase (Hidden on Mobile) */}
        <div className="lg:col-span-6 hidden lg:flex flex-col text-left text-white space-y-8 animate-fade-in pr-6">
          <div className="space-y-4">
            {/* Header Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-400 text-xs font-semibold tracking-wide">
              <BrainCircuit className="w-3.5 h-3.5 text-blue-500" />
              <span>Enterprise AI Recruitment</span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
              Screener & Analytics <br />
              <span className="text-blue-500 font-bold">
                Accelerated by AI.
              </span>
            </h1>
            <p className="text-slate-400 text-sm max-w-md leading-relaxed">
              A high-precision talent parsing suite designed for modern HR enterprises. Automatically evaluate title hierarchies and skill densities instantly.
            </p>
          </div>

          {/* Premium Analytics Preview Widget */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-[#0d1326] shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-mono font-semibold tracking-wider text-slate-400 uppercase">AI PARSING ENGINE</span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/15 text-blue-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                ACTIVE
              </span>
            </div>

            {/* Mock candidate metric stats */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Semantic Skill Density</span>
                  <span className="text-blue-400 font-semibold font-mono">98% Match</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                  <div className="bg-blue-500 h-1 rounded-full w-[98%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Average Hierarchy Matching</span>
                  <span className="text-blue-400 font-semibold font-mono">92% Yield</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden">
                  <div className="bg-blue-500 h-1 rounded-full w-[92%]" />
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <span>Top Active Role: Principal Architect</span>
              <span className="text-slate-400">Score 94.8%</span>
            </div>
          </div>

          {/* Trust bullet points */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm text-slate-350">
              <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 shrink-0">
                <BarChart3 className="w-3 h-3 text-slate-400" />
              </div>
              <span>Real-time SSE Streaming parsing technology</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-355">
              <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 shrink-0">
                <ShieldCheck className="w-3 h-3 text-slate-400" />
              </div>
              <span>OWASP-compliant native cryptographic protections</span>
            </div>
          </div>
        </div>

        {/* Right Side: The Sliding Form */}
        <div className="lg:col-span-6 flex justify-center w-full animate-slide-up">
          <div className="w-full max-w-md relative">
            
            {/* Visual Logo Container for Mobile & Visual Hierarchy */}
            <div className="flex flex-col items-center mb-8 text-center lg:hidden">
              <h1 className="text-4xl font-extrabold tracking-wider text-white">
                Hire<span className="text-blue-500">Grid</span><span className="text-slate-500">.io</span>
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none mt-3 font-semibold">Enterprise Talent Screener & Analytics</p>
            </div>

            {/* Premium Interactive Login Card */}
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden shadow-[0_20px_50px_rgba(8,12,36,0.5)] border border-slate-800 bg-[#0d1326] backdrop-blur-2xl transition-all duration-500">
              
              {/* Brand Indicator (Desktop Header inside the card) */}
              <div className="hidden lg:flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Hire<span className="text-blue-500">Grid</span><span className="text-slate-500">.io</span>
                </h1>
                <span className="text-[10px] uppercase font-mono tracking-widest text-slate-500 font-semibold">SECURE ACCESS</span>
              </div>

              {/* Tab Selector Buttons */}
              <div className="relative flex p-1 mb-8 bg-slate-950 rounded-xl border border-slate-800/80 backdrop-blur-md">
                {/* Sliding indicator */}
                <div 
                  className={`absolute top-1 bottom-1 rounded-lg bg-blue-600 transition-all duration-300 shadow-md ${
                    activeTab === 'signin' 
                      ? 'left-1 w-[calc(50%-4px)]' 
                      : 'left-[calc(50%+2px)] w-[calc(50%-4px)]'
                  }`}
                />
                
                <button
                  onClick={() => handleTabChange('signin')}
                  className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
                    activeTab === 'signin' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  onClick={() => handleTabChange('signup')}
                  className={`relative z-10 flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors duration-200 cursor-pointer ${
                    activeTab === 'signup' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Sign Up
                </button>
              </div>

              <h2 className="text-lg font-bold text-white mb-6">
                {activeTab === 'signin' ? 'Authenticate Dashboard' : 'Create Enterprise Account'}
              </h2>

              {/* Success Message Banner */}
              {successMsg && (
                <div className="mb-6 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-emerald-400 text-xs flex items-start gap-3 animate-fade-in">
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Error Message Banner */}
              {error && (
                <div className="mb-6 p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-400 text-xs flex items-start gap-3 animate-fade-in">
                  <ShieldAlert className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Authorization Error</span>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {/* Form Container */}
              {activeTab === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Corporate Email Address</label>
                    <div className="relative">
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-200 ${
                        focusedInput === 'email' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="glass-input w-full py-3.5 pl-11 pr-4 text-sm"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Security Key / Password</label>
                    <div className="relative">
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-200 ${
                        focusedInput === 'password' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onFocus={() => setFocusedInput('password')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="glass-input w-full py-3.5 pl-11 pr-11 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="glass-button-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 mt-8 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer disabled:opacity-85"
                  >
                    {loading ? (
                      <>
                        {/* Premium Sliding Progress Bar */}
                        <div className="absolute bottom-0 left-0 h-[3px] w-full bg-slate-900 overflow-hidden" suppressHydrationWarning>
                          <div className="h-full w-full bg-blue-600 animate-loading-bar" />
                        </div>
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0" />
                        <span className="font-semibold tracking-wide text-slate-100 animate-pulse">Verifying Credentials...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-4.5 h-4.5" />
                        <span>Log in</span>
                        <ChevronRight className="w-4 h-4 ml-0.5 opacity-60" />
                      </>
                    )}
                  </button>

                  {/* Visual Divider */}
                  <div className="relative my-5 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <span className="relative px-3.5 bg-[#0d1326] text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or authenticate with</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={loading || isGoogleLoading}
                    className="w-full py-3 rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-slate-800 bg-[#080c18] hover:bg-slate-900 hover:border-slate-700 shadow-md disabled:opacity-80 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span className="font-semibold text-xs tracking-wide text-slate-200">Google Account</span>
                    {isGoogleLoading && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0 ml-1" />
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Full Name</label>
                    <div className="relative">
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-200 ${
                        focusedInput === 'name' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onFocus={() => setFocusedInput('name')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Sterling"
                        className="glass-input w-full py-3.5 pl-11 pr-4 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Corporate Email Address</label>
                    <div className="relative">
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-200 ${
                        focusedInput === 'email' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onFocus={() => setFocusedInput('email')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="glass-input w-full py-3.5 pl-11 pr-4 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Security Key / Password</label>
                    <div className="relative">
                      <span className={`absolute inset-y-0 left-0 flex items-center pl-3.5 transition-colors duration-200 ${
                        focusedInput === 'password' ? 'text-blue-400' : 'text-slate-500'
                      }`}>
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onFocus={() => setFocusedInput('password')}
                        onBlur={() => setFocusedInput(null)}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="glass-input w-full py-3.5 pl-11 pr-11 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Corporate Position / Role</label>
                    <div className="relative">
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="glass-input w-full py-3.5 px-4 text-sm cursor-pointer appearance-none bg-[#070b1e] border border-slate-800 hover:border-slate-700 focus:border-blue-500 pr-10"
                      >
                        <option value="Recruitment Lead">Recruitment Lead</option>
                        <option value="Recruitment Director">Recruitment Director</option>
                        <option value="Technical Recruiter">Technical Recruiter</option>
                        <option value="HR Manager">HR Manager</option>
                      </select>
                      {/* Custom indicator chevron inside select */}
                      <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="glass-button-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 mt-8 relative overflow-hidden active:scale-[0.98] transition-all cursor-pointer disabled:opacity-85"
                  >
                    {loading ? (
                      <>
                        {/* Premium Sliding Progress Bar */}
                        <div className="absolute bottom-0 left-0 h-[3px] w-full bg-slate-900 overflow-hidden" suppressHydrationWarning>
                          <div className="h-full w-full bg-blue-600 animate-loading-bar" />
                        </div>
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0" />
                        <span className="font-semibold tracking-wide text-slate-100 animate-pulse">Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4.5 h-4.5" />
                        <span>Create Enterprise Account</span>
                        <ChevronRight className="w-4 h-4 ml-0.5 opacity-60" />
                      </>
                    )}
                  </button>

                  {/* Visual Divider */}
                  <div className="relative my-5 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <span className="relative px-3.5 bg-[#0d1326] text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or authenticate with</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignInClick}
                    disabled={loading || isGoogleLoading}
                    className="w-full py-3 rounded-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer border border-slate-800 bg-[#080c18] hover:bg-slate-900 hover:border-slate-700 shadow-md disabled:opacity-80 active:scale-[0.98]"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span className="font-semibold text-xs tracking-wide text-slate-200">Google Account</span>
                    {isGoogleLoading && (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin shrink-0 ml-1" />
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Footer info (Desktop/Visual context alignment) */}
            <p className="text-center text-xs text-slate-600 mt-8">
              &copy; {new Date().getFullYear()} HireGrid.io. All rights reserved.
            </p>
          </div>
        </div>

      </div>

      {/* High-Fidelity Google Accounts Identity Simulator Modal */}
      {showMockGoogleDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in text-left">
          <div className="w-full max-w-sm rounded-2xl bg-[#0d1326] border border-slate-800 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative animate-scale-up">
            
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowMockGoogleDialog(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer text-sm font-semibold"
              title="Close simulator"
            >
              ✕
            </button>

            {/* Title Block */}
            <div className="flex flex-col items-center text-center mt-3 mb-6">
              <svg className="w-8 h-8 mb-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <h3 className="text-base font-bold text-white tracking-wide">Sign in with Google</h3>
              <p className="text-[11px] text-slate-400 mt-1">to continue to <span className="font-semibold text-blue-400">HireGrid.io</span></p>
            </div>

            {/* Real Google Account Live Button (Dynamic Container) */}
            {googleClientId && !googleClientId.includes("placeholder") && !googleClientId.includes("YOUR_") && (
              <div className="mb-5 pb-5 border-b border-slate-800 flex flex-col items-center">
                <div id="google-live-btn-container" className="w-full flex justify-center"></div>
                <div className="relative w-full flex items-center justify-center mt-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-800"></div>
                  </div>
                  <span className="relative px-3.5 bg-[#0d1326] text-[8px] font-bold text-slate-500 uppercase tracking-widest">Or Use Sandbox Bypass</span>
                </div>
              </div>
            )}

            {/* List of Simulated Developer Profiles */}
            {!useCustomMock ? (
              <div className="space-y-3">
                {/* Account AS */}
                <button
                  onClick={() => handleMockAccountSelect('admin@hiregrid.io', 'Alex Sterling')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-[#080c18] hover:bg-slate-900 hover:border-slate-700 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center shrink-0">
                      AS
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block group-hover:text-blue-500 transition-colors">Alex Sterling</span>
                      <span className="text-[10px] text-slate-500">admin@hiregrid.io</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase">SEED ADMIN</span>
                </button>

                {/* Account SL */}
                <button
                  onClick={() => handleMockAccountSelect('sarah.lin@hiregrid.io', 'Sarah Lin')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-[#080c18] hover:bg-slate-900 hover:border-slate-700 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8.5 h-8.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center shrink-0">
                      SL
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white block group-hover:text-blue-500 transition-colors">Sarah Lin</span>
                      <span className="text-[10px] text-slate-500">sarah.lin@hiregrid.io</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 uppercase">ENGINEER</span>
                </button>

                {/* Add Custom Account */}
                <button
                  type="button"
                  onClick={() => setUseCustomMock(true)}
                  className="w-full py-3 rounded-xl border border-dashed border-slate-800 hover:border-slate-700 bg-transparent hover:bg-white/[0.01] transition-all text-center text-xs font-semibold text-slate-450 cursor-pointer"
                >
                  + Use Another Account
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 animate-fade-in text-left">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Simulated Profile Name</label>
                  <input
                    type="text"
                    required
                    value={customMockName}
                    onChange={(e) => setCustomMockName(e.target.value)}
                    placeholder="Jane Doe"
                    className="glass-input w-full py-2.5 px-3 text-xs bg-slate-950 border border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Simulated Profile Email</label>
                  <input
                    type="email"
                    required
                    value={customMockEmail}
                    onChange={(e) => setCustomMockEmail(e.target.value)}
                    placeholder="jane.doe@company.com"
                    className="glass-input w-full py-2.5 px-3 text-xs bg-slate-950 border border-slate-800"
                  />
                </div>

                <div className="flex items-center gap-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setUseCustomMock(false)}
                    className="flex-1 py-2.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 text-xs font-semibold hover:bg-slate-900 hover:text-white cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (customMockName.trim() && customMockEmail.includes('@')) {
                        handleMockAccountSelect(customMockEmail, customMockName);
                      } else {
                        alert("Please provide a valid mock name and email.");
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 cursor-pointer"
                  >
                    Authorize
                  </button>
                </div>
              </div>
            )}

            {/* Sandbox Developer Tip */}
            <div className="mt-5 pt-4 border-t border-slate-800 text-[9px] text-slate-500 leading-relaxed">
              <span className="font-semibold block text-slate-400 mb-0.5">⚙️ Local Bypass Environment</span>
              Google Authentication is running in simulated sandbox mode. To switch to live production Google Login, configure <code className="bg-slate-950 px-1 py-0.5 rounded text-slate-400 font-mono">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>.
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

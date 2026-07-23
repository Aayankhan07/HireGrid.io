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
  
  // Google Auth States
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const [googleSdkLoaded, setGoogleSdkLoaded] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
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

  // Hook to render live official Google Sign-In Button directly on forms
  useEffect(() => {
    if (googleClientId && googleSdkLoaded) {
      const isRealClient = googleClientId && 
                           !googleClientId.includes("placeholder") && 
                           !googleClientId.includes("YOUR_");
      if (isRealClient) {
        const timer = setTimeout(() => {
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

            const btnSignin = document.getElementById("google-signin-btn-signin");
            if (btnSignin) {
              // @ts-ignore
              google.accounts.id.renderButton(
                btnSignin,
                { 
                  theme: "filled_blue", 
                  size: "large", 
                  width: btnSignin.clientWidth || 382,
                  text: "signin_with"
                }
              );
            }

            const btnSignup = document.getElementById("google-signin-btn-signup");
            if (btnSignup) {
              // @ts-ignore
              google.accounts.id.renderButton(
                btnSignup,
                { 
                  theme: "filled_blue", 
                  size: "large", 
                  width: btnSignup.clientWidth || 382,
                  text: "signin_with"
                }
              );
            }
          } catch (e) {
            console.warn("Failed to render native Google button:", e);
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }
  }, [googleClientId, googleSdkLoaded, activeTab]);

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

  const handleFillDemo = () => {
    setEmail('admin@hiregrid.io');
    setPassword('password123');
    setError('');
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

                  {/* Demo Credentials Auto Fill Helper */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-500 text-[11px]">Testing demo account?</span>
                    <button
                      type="button"
                      onClick={handleFillDemo}
                      className="text-blue-400 font-semibold hover:underline cursor-pointer text-xs"
                    >
                      Fill Demo Admin (admin@hiregrid.io)
                    </button>
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

                  {/* Real Google Account Login Button */}
                  {googleClientId && !googleClientId.includes("placeholder") && !googleClientId.includes("YOUR_") && (
                    <>
                      {/* Visual Divider */}
                      <div className="relative my-5 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-800"></div>
                        </div>
                        <span className="relative px-3.5 bg-[#0d1326] text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or authenticate with</span>
                      </div>

                      <div className="w-full flex justify-center">
                        <div id="google-signin-btn-signin" className="w-full min-h-[44px]"></div>
                      </div>
                    </>
                  )}
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

                  {/* Real Google Account Login Button */}
                  {googleClientId && !googleClientId.includes("placeholder") && !googleClientId.includes("YOUR_") && (
                    <>
                      {/* Visual Divider */}
                      <div className="relative my-5 flex items-center justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-800"></div>
                        </div>
                        <span className="relative px-3.5 bg-[#0d1326] text-[9px] font-bold text-slate-500 uppercase tracking-widest">Or authenticate with</span>
                      </div>

                      <div className="w-full flex justify-center">
                        <div id="google-signin-btn-signup" className="w-full min-h-[44px]"></div>
                      </div>
                    </>
                  )}
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

    </div>
  );
}

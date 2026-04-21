import { Link } from "wouter";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Database, Activity, ShieldCheck, Cpu, Send, BarChart3, Bell, BookOpen, ArrowRight, XCircle, CheckCircle2, Layers } from "lucide-react";
import { SiX } from "react-icons/si";

/**
 * LANDING PAGE — Theme: Iron Strike Coach (TrendSpider Clone Mindset)
 * Visual Language:
 * - Backgrounds: #000000 (Void), #0b0e14 (Deep Panel)
 * - Borders: #2a2e39 (Subtle Tech)
 * - Texture: Unified Grid (40px), Global Noise
 */

const CAPABILITY_PILLARS = [
  {
    icon: BarChart3,
    title: "Market Context Engine",
    description: "Ingests multi-timeframe data to construct a risk-first structural map of the market.",
  },
  {
    icon: Activity,
    title: "Opportunity Screener",
    description: "Filters universe by liquidity, volatility structure, and relative strength—automatically.",
  },
  {
    icon: Cpu,
    title: "Logic-Based Signal",
    description: "Generates entry/exit context based on strict conditional logic, not predictive guessing.",
  },
  {
    icon: Bell,
    title: "Cross-Channel Alerting",
    description: "Deliver structured decision packets to Telegram, Discord, or Webhooks instantly.",
  },
  {
    icon: BookOpen,
    title: "Behavioral Journaling",
    description: "Forced accountability logging to track decision quality vs. outcome quality.",
  },
  {
    icon: ShieldCheck,
    title: "Feedback Loop",
    description: "Post-trade analysis engine to refine edge and eliminate emotional leaks.",
  },
];

const TICKER_DATA = [
  { sym: "SPY", val: "412.50", chg: "+0.85%", up: true },
  { sym: "QQQ", val: "320.10", chg: "+1.20%", up: true },
  { sym: "IWM", val: "185.30", chg: "-0.45%", up: false },
  { sym: "VIX", val: "18.50", chg: "-2.10%", up: false },
  { sym: "AAPL", val: "175.20", chg: "+0.50%", up: true },
  { sym: "NVDA", val: "480.00", chg: "+2.15%", up: true },
  { sym: "TLT", val: "92.50", chg: "-0.15%", up: false },
  { sym: "BTC", val: "45,200", chg: "+3.50%", up: true },
  { sym: "ETH", val: "2,400", chg: "+2.80%", up: true },
  { sym: "AMD", val: "110.45", chg: "+1.10%", up: true },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#000000] text-gray-100 font-sans selection:bg-blue-500/30 overflow-x-hidden relative" data-testid="landing-container">
      
      {/* Global Visual Assets */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(42,46,57,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(42,46,57,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      {/* Ticker Tape */}
      <div className="fixed top-0 w-full z-50 bg-[#0b0e14] border-b border-[#2a2e39] h-8 flex items-center overflow-hidden" data-testid="ticker-tape">
        <div className="flex animate-ticker-scroll whitespace-nowrap gap-8 px-4">
          {[...TICKER_DATA, ...TICKER_DATA].map((item, i) => (
            <div key={i} className="flex items-center space-x-2 text-xs font-mono">
              <span className="font-bold text-[#22D3EE]">{item.sym}</span>
              <span className="text-gray-300">{item.val}</span>
              <span className={item.up ? "text-[#22C55E]" : "text-[#EF4444]"}>{item.chg}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-8 w-full z-40 bg-[#000000]/80 backdrop-blur-md border-b border-[#2a2e39]" data-testid="landing-header">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-br from-[#22D3EE] to-[#0891B2] rounded flex items-center justify-center shadow-lg shadow-cyan-900/20">
                <Activity className="text-white w-5 h-5" />
             </div>
             <div className="flex flex-col">
               <span className="font-bold text-lg tracking-wider text-gray-100 leading-none">
                 IRON STRIKE
               </span>
               <span className="text-[10px] text-[#22D3EE] uppercase tracking-[0.2em] leading-none">
                 Decision OS
               </span>
             </div>
          </div>

          <nav className="hidden md:flex items-center gap-8" data-testid="nav-links">
            <Link href="/">
              <span className="text-sm font-medium text-gray-100 hover:text-[#22D3EE] transition-colors cursor-pointer uppercase tracking-wide" data-testid="link-platform">
                Platform
              </span>
            </Link>
            <Link href="/how-it-works">
              <span className="text-sm font-medium text-gray-400 hover:text-[#22D3EE] transition-colors cursor-pointer uppercase tracking-wide" data-testid="link-how-it-works">
                How It Works
              </span>
            </Link>
            <Link href="/methodology">
              <span className="text-sm font-medium text-gray-400 hover:text-[#22D3EE] transition-colors cursor-pointer uppercase tracking-wide" data-testid="link-methodology">
                Methodology
              </span>
            </Link>
            <Link href="/pricing">
              <span className="text-sm font-medium text-gray-400 hover:text-[#22D3EE] transition-colors cursor-pointer uppercase tracking-wide" data-testid="link-pricing">
                Pricing
              </span>
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <SignedOut>
              {/* Dev login bypass - only in development */}
              {import.meta.env.DEV && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 border border-amber-500/50"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/dev/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: '{}'
                      });
                      const data = await res.json();
                      if (data.success) {
                        localStorage.setItem('devAuthToken', data.devToken);
                        window.location.href = '/app';
                      } else {
                        console.error('Dev login failed:', data.error);
                      }
                    } catch (err) {
                      console.error('Dev login error:', err);
                    }
                  }}
                  data-testid="button-dev-login"
                >
                  Dev Login
                </Button>
              )}
              <SignInButton mode="redirect" forceRedirectUrl="/app">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-gray-400 hover:text-white hover:bg-[#1e222d]"
                  data-testid="button-signin"
                >
                  Log In
                </Button>
              </SignInButton>
            </SignedOut>

            <SignedIn>
              <Link href="/app">
                <Button 
                  size="sm"
                  className="bg-[#22D3EE] hover:bg-[#22D3EE]/80 text-[#0B0F14] font-medium border border-[#22D3EE]/50 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                  data-testid="button-enter-platform"
                >
                  Enter Platform
                </Button>
              </Link>
            </SignedIn>

            <SignedOut>
              <Link href="/app">
                <Button 
                  size="sm"
                  className="bg-[#22D3EE] hover:bg-[#22D3EE]/80 text-[#0B0F14] font-medium border border-[#22D3EE]/50 shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                  data-testid="button-launch-app"
                >
                  Launch App
                </Button>
              </Link>
            </SignedOut>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden z-10" data-testid="section-hero">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,34,45,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(30,34,45,0.5)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,#000_10%,transparent_100%)] pointer-events-none" />
        
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center relative z-10">
          
          {/* Hero SVG Integration */}
          <div className="w-full max-w-5xl mb-12 animate-in fade-in zoom-in duration-1000">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none" className="w-full h-auto drop-shadow-2xl">
              <defs>
                <filter id="glow-intense" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur"/>
                  <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
                <filter id="glow-screen" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur"/>
                  <feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
                <filter id="shadow-floor" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" in="SourceAlpha"/>
                  <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.5 0"/>
                </filter>
                <linearGradient id="iron-side-left" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4a5568"/>
                  <stop offset="100%" stopColor="#2d3748"/>
                </linearGradient>
                <linearGradient id="iron-side-right" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2d3748"/>
                  <stop offset="100%" stopColor="#1a202c"/>
                </linearGradient>
                <linearGradient id="iron-top" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#718096"/>
                  <stop offset="100%" stopColor="#4a5568"/>
                </linearGradient>
                <linearGradient id="screen-glass" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1a202c" stopOpacity="0.9"/>
                  <stop offset="100%" stopColor="#000000" stopOpacity="0.95"/>
                </linearGradient>
                <linearGradient id="ai-holo" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0"/>
                  <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.2"/>
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="beam-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0"/>
                  <stop offset="50%" stopColor="#22D3EE" stopOpacity="0.6"/>
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="tech-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.8"/>
                  <stop offset="100%" stopColor="#0891B2" stopOpacity="0.6"/>
                </linearGradient>
              </defs>

              <text x="400" y="60" className="fill-[#e2e8f0]" style={{ fontFamily: "'Segoe UI', sans-serif", fontWeight: 700, fontSize: '32px', textAnchor: 'middle', letterSpacing: '1px' }}>DECISION INTELLIGENCE PLATFORM</text>
              <text x="400" y="95" className="fill-[#22D3EE]" style={{ fontFamily: "'Segoe UI', sans-serif", fontWeight: 400, fontSize: '18px', textAnchor: 'middle', letterSpacing: '3px', textTransform: 'uppercase' }}>Structure uncertainty. Enforce discipline.</text>
              <line x1="250" y1="110" x2="550" y2="110" stroke="#4a5568" strokeWidth="1" />

              <g transform="translate(0, 50)">
                <g transform="translate(0, 40)" opacity="0.6">
                  <ellipse cx="400" cy="300" rx="100" ry="30" fill="black" filter="url(#shadow-floor)"/> 
                  <ellipse cx="220" cy="300" rx="40" ry="10" fill="black" filter="url(#shadow-floor)"/> 
                  <ellipse cx="580" cy="300" rx="40" ry="10" fill="black" filter="url(#shadow-floor)"/> 
                </g>
                <g stroke="url(#beam-grad)" strokeWidth="2" strokeDasharray="4 4">
                  <line x1="400" y1="260" x2="220" y2="280" opacity="0.6">
                    <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2s" repeatCount="indefinite"/>
                  </line>
                  <line x1="400" y1="260" x2="580" y2="280" opacity="0.6">
                    <animate attributeName="stroke-dashoffset" from="0" to="100" dur="2s" repeatCount="indefinite"/>
                  </line>
                </g>
                {/* Left Screen */}
                <g transform="translate(220, 300)">
                  <path d="M-40 0 L0 10 L40 0 L0 -10 Z" fill="url(#iron-top)" stroke="#22D3EE" strokeWidth="0.5"/>
                  <path d="M-40 0 L0 10 L0 20 L-40 10 Z" fill="url(#iron-side-left)"/>
                  <path d="M40 0 L0 10 L0 20 L40 10 Z" fill="url(#iron-side-right)"/>
                  <g transform="translate(0, -45)">
                    <rect x="-42" y="-32" width="84" height="64" rx="2" fill="#2d3748" stroke="#4a5568" strokeWidth="1"/>
                    <rect x="-40" y="-30" width="80" height="60" fill="url(#screen-glass)"/>
                    <path d="M-40 -10 H40 M-40 10 H40 M-20 -30 V30 M20 -30 V30" stroke="#2d3748" strokeWidth="0.5"/>
                    <g filter="url(#glow-screen)">
                      <line x1="-30" y1="0" x2="-30" y2="20" stroke="#EF4444" strokeWidth="1"/>
                      <rect x="-33" y="5" width="6" height="10" fill="#EF4444"/>
                      <line x1="-15" y1="-10" x2="-15" y2="10" stroke="#22C55E" strokeWidth="1"/>
                      <rect x="-18" y="-5" width="6" height="12" fill="#22C55E"/>
                      <line x1="0" y1="-20" x2="0" y2="0" stroke="#22C55E" strokeWidth="1"/>
                      <rect x="-3" y="-15" width="6" height="10" fill="#22C55E"/>
                    </g>
                    <path d="M-8 -20 H-2 V-12 M8 -20 H2 V-12 M-8 -8 H-2 V-16 M8 -8 H2 V-16" stroke="#22D3EE" strokeWidth="1" fill="none" opacity="0.8">
                      <animateTransform attributeName="transform" type="scale" values="1;1.1;1" dur="1.5s" repeatCount="indefinite"/>
                    </path>
                  </g>
                </g>
                {/* Right Screen */}
                <g transform="translate(580, 300)">
                  <path d="M-40 0 L0 10 L40 0 L0 -10 Z" fill="url(#iron-top)" stroke="#22D3EE" strokeWidth="0.5"/>
                  <path d="M-40 0 L0 10 L0 20 L-40 10 Z" fill="url(#iron-side-left)"/>
                  <path d="M40 0 L0 10 L0 20 L40 10 Z" fill="url(#iron-side-right)"/>
                  <g transform="translate(0, -45)">
                    <rect x="-42" y="-32" width="84" height="64" rx="2" fill="#2d3748" stroke="#4a5568" strokeWidth="1"/>
                    <rect x="-40" y="-30" width="80" height="60" fill="url(#screen-glass)"/>
                    <path d="M-40 0 H40 M0 -30 V30" stroke="#2d3748" strokeWidth="0.5"/>
                    <polyline points="-35,20 -20,10 -10,15 0,0 15,-5 25,-20 35,-15" fill="none" stroke="#22D3EE" strokeWidth="1.5" filter="url(#glow-screen)"/>
                    <path d="M-35 20 L-20 10 L-10 15 L0 0 L15 -5 L25 -20 L35 -15 V30 H-35 Z" fill="url(#beam-grad)" opacity="0.3"/>
                  </g>
                </g>
                {/* Monolith */}
                <g transform="translate(400, 280)">
                  <path d="M-50 -15 L0 -30 L50 -15 L50 20 L0 35 L-50 20 Z" fill="url(#iron-top)" stroke="#0891B2" strokeWidth="1"/>
                  <path d="M-50 20 L0 35 L0 100 L-50 85 Z" fill="url(#iron-side-left)" stroke="#1a202c" strokeWidth="0.5"/>
                  <path d="M50 20 L0 35 L0 100 L50 85 Z" fill="url(#iron-side-right)" stroke="#1a202c" strokeWidth="0.5"/>
                  <rect x="-15" y="0" width="30" height="80" fill="url(#tech-blue)" opacity="0.9" filter="url(#glow-intense)"/>
                  <g transform="translate(0, -60)">
                    <path d="M-30 40 L0 80 L30 40" fill="url(#ai-holo)"/>
                    <ellipse cx="0" cy="30" rx="40" ry="10" fill="none" stroke="#22D3EE" strokeWidth="0.5" opacity="0.7">
                      <animateTransform attributeName="transform" type="rotate" from="0 0 30" to="360 0 30" dur="10s" repeatCount="indefinite"/>
                    </ellipse>
                    <ellipse cx="0" cy="30" rx="30" ry="8" fill="none" stroke="#22D3EE" strokeWidth="0.5" opacity="0.9">
                      <animateTransform attributeName="transform" type="rotate" from="360 0 30" to="0 0 30" dur="7s" repeatCount="indefinite"/>
                    </ellipse>
                    <circle cx="0" cy="30" r="5" fill="#e2e8f0" filter="url(#glow-intense)"/>
                    <text x="0" y="55" className="fill-[#22D3EE]" style={{ fontFamily: "'Consolas', monospace", fontSize: '8px', textAnchor: 'middle' }}>AI COACH</text>
                  </g>
                  <path d="M-50 -15 L0 -30 L50 -15 L0 0 Z" fill="#a0aec0" opacity="0.3"/>
                </g>
              </g>

              <g transform="translate(0, 520)">
                <text x="400" y="0" className="fill-[#a0aec0]" style={{ fontFamily: "'Segoe UI', sans-serif", fontWeight: 300, fontSize: '14px', textAnchor: 'middle' }}>Iron Strike is a decision operating system for options traders.</text>
                <text x="400" y="20" className="fill-[#a0aec0]" style={{ fontFamily: "'Segoe UI', sans-serif", fontWeight: 300, fontSize: '14px', textAnchor: 'middle' }}>It provides structured context and risk evaluation.</text>
                <text x="400" y="50" className="fill-[#718096]" style={{ fontFamily: "'Segoe UI', sans-serif", fontWeight: 300, fontSize: '10px', textAnchor: 'middle', fontStyle: 'italic' }}>— not predictions, not recommendations, not financial advice —</text>
              </g>
            </svg>
            
            {/* CTA Buttons */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
              <Link href="/app">
                <Button 
                  size="lg" 
                  className="bg-[#22D3EE] hover:bg-[#22D3EE]/80 text-[#0B0F14] font-bold h-12 px-8 border border-[#22D3EE]/50 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                  data-testid="button-enter-system"
                >
                  Enter the System
                </Button>
              </Link>
              <Link href="/methodology">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="bg-[#131722] border-gray-700 text-gray-300 hover:text-white hover:border-[#22D3EE] h-12 px-8"
                  data-testid="button-view-methodology"
                >
                  View Methodology
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="relative z-10 border-y border-[#2a2e39] bg-[#0b0e14] py-8" data-testid="section-trust-bar">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap justify-center md:justify-between items-center gap-8">
           {[
             { label: "Candles Analyzed", val: "1B+" },
             { label: "Uptime", val: "99.99%" },
             { label: "Predictions Made", val: "ZERO", color: "text-[#22D3EE]" },
             { label: "Discipline Enforced", val: "100%", color: "text-[#22C55E]" },
           ].map((stat, i) => (
             <div key={i} className="flex flex-col items-center md:items-start" data-testid={`stat-${i}`}>
               <span className={`text-2xl font-black font-mono tracking-tighter ${stat.color || 'text-white'}`}>{stat.val}</span>
               <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">{stat.label}</span>
             </div>
           ))}
        </div>
      </section>

      {/* Comparative Problem/Solution */}
      <section className="py-24 relative z-10" data-testid="section-comparison">
         <div className="absolute inset-0 bg-[#000000]/40 pointer-events-none" />
         
         <div className="mx-auto max-w-7xl px-6 relative">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">The Retail Trap vs. <span className="text-[#22D3EE]">The Iron Way</span></h2>
             <p className="text-gray-400 max-w-2xl mx-auto text-lg">
               Most traders fail because they treat the market as a casino. Iron Strike forces you to treat it as a business.
             </p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* The Old Way */}
             <div className="p-8 rounded-2xl bg-[#0b0e14] border border-red-900/30 relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-900/20 blur-[60px] rounded-full group-hover:bg-red-900/30 transition-all" />
               <div className="flex items-center gap-3 mb-6">
                 <XCircle className="text-[#EF4444] w-8 h-8" />
                 <h3 className="text-2xl font-bold text-gray-200">The Retail Trap</h3>
               </div>
               <ul className="space-y-4">
                 {[
                   "Trading based on Twitter alerts",
                   "Emotional entries (FOMO)",
                   "No defined risk per trade",
                   "Switching strategies weekly",
                   "Zero post-trade analysis"
                 ].map((item, i) => (
                   <li key={i} className="flex items-start gap-3 text-gray-400">
                     <span className="text-red-900 mt-1">✕</span>
                     {item}
                   </li>
                 ))}
               </ul>
             </div>

             {/* The Iron Way */}
             <div className="p-8 rounded-2xl bg-[#131722] border border-[#22D3EE]/50 relative overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.15)]">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-cyan-600/20 blur-[60px] rounded-full animate-pulse" />
               <div className="flex items-center gap-3 mb-6">
                 <CheckCircle2 className="text-[#22D3EE] w-8 h-8" />
                 <h3 className="text-2xl font-bold text-white">The Iron Way</h3>
               </div>
               <ul className="space-y-4">
                 {[
                   "Data-driven structural context",
                   "Logic-based execution filters",
                   "Pre-defined risk parameters",
                   "Consistent mechanical edge",
                   "Feedback loops for growth"
                 ].map((item, i) => (
                   <li key={i} className="flex items-start gap-3 text-gray-200">
                     <CheckCircle2 className="w-4 h-4 text-[#22D3EE] mt-1" />
                     {item}
                   </li>
                 ))}
               </ul>
             </div>
           </div>
         </div>
      </section>

      {/* Capabilities Section */}
      <section className="bg-[#131722]/80 backdrop-blur-sm py-24 border-y border-[#2a2e39] relative z-10" data-testid="section-capabilities">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Layers className="text-[#22D3EE]" />
              Platform Modules
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CAPABILITY_PILLARS.map((pillar, idx) => (
              <div 
                key={idx} 
                className="group p-6 bg-[#000000]/50 border border-[#2a2e39] rounded-xl hover:border-[#22D3EE]/50 hover:bg-[#000000]/80 transition-all duration-300"
                data-testid={`capability-${idx}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#131722] border border-[#2a2e39] flex items-center justify-center group-hover:bg-[#22D3EE]/10 group-hover:border-[#22D3EE]/30 transition-colors">
                    <pillar.icon className="w-6 h-6 text-gray-400 group-hover:text-[#22D3EE] transition-colors" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#2a2e39] group-hover:text-[#22D3EE] -rotate-45 group-hover:rotate-0 transition-all duration-300" />
                </div>
                <h3 className="font-bold text-white text-lg mb-2 group-hover:text-cyan-100">{pillar.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed group-hover:text-gray-300">
                  {pillar.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Flow */}
      <section className="py-24 relative z-10" data-testid="section-process">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <span className="text-[#22D3EE] font-mono text-xs uppercase tracking-widest">Workflow</span>
            <h2 className="text-3xl font-bold text-white mt-2">How It Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="hidden md:block absolute top-10 left-12 right-12 h-0.5 bg-[#131722] z-0" />
            
            {[
              { icon: Database, title: "Data Ingest", desc: "Real-time feeds processed" },
              { icon: Cpu, title: "Signal Logic", desc: "Edge models applied" },
              { icon: ShieldCheck, title: "Risk Check", desc: "Volatility adjusted" },
              { icon: Activity, title: "Context", desc: "Decision map generated" },
              { icon: Send, title: "Execution", desc: "Precise entry/exit" },
            ].map((item, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center text-center group" data-testid={`process-step-${idx}`}>
                <div className="w-20 h-20 rounded-full bg-[#000000] border-4 border-[#131722] flex items-center justify-center mb-6 group-hover:border-[#22D3EE] transition-colors duration-500">
                  <item.icon className="w-8 h-8 text-gray-500 group-hover:text-[#22D3EE] transition-colors" />
                </div>
                <h3 className="text-white font-bold mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-[#2a2e39] bg-gradient-to-b from-[#131722] to-[#000000] relative z-10" data-testid="section-cta">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to professionalize your workflow?</h2>
          <p className="text-lg text-gray-400 mb-10">
            Join the traders who have replaced guessing with structure.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
             <Link href="/app">
               <Button size="lg" className="bg-[#22D3EE] hover:bg-[#22D3EE]/80 text-[#0B0F14] h-14 px-10 text-lg shadow-lg shadow-cyan-900/20" data-testid="button-get-started">
                 Get Started Now
               </Button>
             </Link>
             <Link href="/pricing">
               <Button variant="outline" size="lg" className="bg-transparent border-gray-600 text-gray-300 hover:text-white h-14 px-10 text-lg" data-testid="button-view-pricing">
                 View Pricing
               </Button>
             </Link>
          </div>
          <p className="mt-6 text-xs text-gray-600">No credit card required for demo access.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#000000] py-12 border-t border-[#2a2e39] relative z-10" data-testid="landing-footer">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2">
             <div className="w-6 h-6 bg-cyan-900/50 rounded flex items-center justify-center">
                <Activity className="w-3 h-3 text-[#22D3EE]" />
             </div>
             <span className="text-sm font-bold text-gray-300">IRON STRIKE</span>
           </div>

           <div className="flex gap-8 text-xs text-gray-500 font-medium items-center">
             <Link href="/how-it-works"><span className="hover:text-white cursor-pointer" data-testid="link-footer-how">HOW IT WORKS</span></Link>
             <Link href="/methodology"><span className="hover:text-white cursor-pointer" data-testid="link-footer-methodology">METHODOLOGY</span></Link>
             <Link href="/pricing"><span className="hover:text-white cursor-pointer" data-testid="link-footer-pricing">PRICING</span></Link>
             <Link href="/contact"><span className="hover:text-white cursor-pointer" data-testid="link-footer-contact">CONTACT</span></Link>
             <a 
               href="https://x.com/iron_strike_ai" 
               target="_blank"
               rel="noopener noreferrer"
               className="hover:text-white transition-colors"
               data-testid="link-footer-twitter"
             >
               <SiX className="h-4 w-4" />
             </a>
           </div>
        </div>

        <div className="mx-auto max-w-7xl px-6 mt-8 pt-6 border-t border-[#2a2e39]/30">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-8 text-xs text-gray-500 font-medium">
              <Link href="/terms"><span className="hover:text-white cursor-pointer" data-testid="link-footer-terms">TERMS</span></Link>
              <Link href="/privacy"><span className="hover:text-white cursor-pointer" data-testid="link-footer-privacy">PRIVACY</span></Link>
              <Link href="/risk-disclosure"><span className="hover:text-white cursor-pointer" data-testid="link-footer-risk">RISK DISCLOSURE</span></Link>
              <Link href="/disclaimer"><span className="hover:text-white cursor-pointer" data-testid="link-footer-disclaimer">DISCLAIMER</span></Link>
            </div>
            
            <div className="text-[10px] text-gray-600 max-w-xs text-right" data-testid="text-footer-copyright">
               Not financial advice. Options trading involves significant risk of loss.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

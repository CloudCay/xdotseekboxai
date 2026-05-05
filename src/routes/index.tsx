import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { Search, Play, Zap, Check, Sparkles, Activity, Layers, Terminal, Cpu, Bot, Globe, Shield } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-[#050B14] text-slate-50 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Deep Navy/Black Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#050B14] via-[#0A1128] to-[#050B14]"></div>
        
        {/* Cyberpunk Grid / Circuit Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTU5IDYwSDBWMGg2MHY2MHpNMTAgMTBoNDB2NDBIMTB6IiBmaWxsPSJub25lIiBzdHJva2U9InJnYmEoMzAsIDU4LCAxMzgsIDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)] opacity-40" />
        
        {/* Volumetric Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/20 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[150px] mix-blend-screen" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-900/30 rounded-full blur-[120px] mix-blend-screen" />
        
        {/* Subtle Animated Particles (CSS representation) */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" style={{ transform: 'translateY(0)', animation: 'slideUp 60s linear infinite' }} />
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideUp {
            0% { transform: translateY(0); }
            100% { transform: translateY(-100%); }
          }
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(5deg); }
          }
          @keyframes float-medium {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-15px) rotate(-5deg); }
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.8; box-shadow: 0 0 20px rgba(239,68,68,0.4); }
            50% { opacity: 1; box-shadow: 0 0 40px rgba(239,68,68,0.8); }
          }
        `}} />
      </div>

      {/* Floating AI Icons Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-[10%] text-white/5" style={{ animation: 'float-slow 15s ease-in-out infinite' }}>
          <Bot size={64} />
        </div>
        <div className="absolute top-1/3 right-[15%] text-white/5" style={{ animation: 'float-medium 12s ease-in-out infinite' }}>
          <Cpu size={80} />
        </div>
        <div className="absolute bottom-1/4 left-[20%] text-white/5" style={{ animation: 'float-medium 18s ease-in-out infinite' }}>
          <Layers size={72} />
        </div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6 flex items-center justify-between max-w-7xl mx-auto border-b border-white/5 bg-[#050B14]/50 backdrop-blur-md rounded-b-2xl">
        <div className="flex items-center gap-4">
          {/* Logo: 3D SeekBox Cube */}
          <div className="relative w-14 h-14 group perspective-1000" style={{ perspective: '1000px' }}>
            <div className="w-full h-full transform-gpu transition-transform duration-700 group-hover:rotate-y-12 group-hover:rotate-x-12" style={{ transformStyle: 'preserve-3d', transform: 'rotateX(15deg) rotateY(-20deg) rotateZ(-5deg)' }}>
              {/* Faces of the cube represented as a 2x2 grid for front face */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.6)] bg-slate-800 border border-slate-700/50 p-0.5 z-10">
                <div className="bg-[#EF4444] rounded-tl-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                </div>
                {/* Top Blue Face with Glowing Magnifying Glass */}
                <div className="bg-[#3B82F6] rounded-tr-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent shadow-[inset_0_0_15px_rgba(255,255,255,0.5)]"></div>
                  <Search className="w-5 h-5 text-white absolute drop-shadow-[0_0_10px_rgba(255,255,255,1)]" strokeWidth={3} />
                </div>
                <div className="bg-[#EAB308] rounded-bl-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                </div>
                <div className="bg-[#10B981] rounded-br-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                </div>
              </div>
              {/* Fake 3D depth */}
              <div className="absolute inset-0 bg-cyan-900 rounded-xl transform-gpu translate-z-[-10px] blur-[2px] opacity-50 z-0"></div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight leading-none text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">SeekBoxAi</h1>
            <p className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase mt-1 opacity-90 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">AI Search App</p>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide">
          <Link to="/" className="text-slate-300 hover:text-cyan-400 transition-colors drop-shadow-sm">Platform</Link>
          <Link to="/faq" className="text-slate-300 hover:text-cyan-400 transition-colors drop-shadow-sm">Models</Link>
          <Link to="/faq" className="text-slate-300 hover:text-cyan-400 transition-colors drop-shadow-sm">Pricing</Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1400px] mx-auto px-6 pt-16 pb-24 lg:pt-24">
        
        {/* Floating Elements (Right/Left) */}
        <div className="absolute top-20 right-10 hidden xl:flex flex-col gap-6 z-20">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/30 p-4 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.15)] transform rotate-2 flex items-center gap-4 hover:rotate-0 transition-transform cursor-default" style={{ animation: 'float-slow 8s ease-in-out infinite' }}>
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-xl">
                $20
              </div>
            </div>
            <div>
              <p className="font-bold text-white tracking-wide">Power Tier</p>
              <p className="text-xs text-cyan-400 font-medium">Unlimited Multi-Search</p>
            </div>
          </div>
          
          <div className="bg-slate-900/60 backdrop-blur-xl border border-red-500/30 p-3.5 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.15)] transform -rotate-3 flex items-center gap-3 hover:rotate-0 transition-transform cursor-default" style={{ animation: 'float-medium 9s ease-in-out infinite', animationDelay: '1s' }}>
            <div className="w-10 h-10 rounded-xl bg-black border border-slate-800 flex items-center justify-center text-white shadow-[inset_0_0_10px_rgba(255,255,255,0.1)]">
              <span className="font-black text-lg tracking-tighter">X</span>
            </div>
            <div>
              <p className="font-bold text-sm text-white flex items-center gap-2">
                Grok Live <span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span></span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">xAI Integration</p>
            </div>
          </div>
        </div>

        <div className="absolute top-40 left-10 hidden xl:flex flex-col z-20">
           <div className="bg-[#050B14]/80 backdrop-blur-md border border-slate-700/50 px-4 py-2 rounded-full shadow-lg transform -rotate-2 flex items-center gap-3" style={{ animation: 'float-medium 10s ease-in-out infinite', animationDelay: '0.5s' }}>
             <Activity className="w-4 h-4 text-purple-400" />
             <span className="text-sm font-semibold text-slate-200">Real-time X • 10 AI Models</span>
           </div>
        </div>

        {/* Hero Text */}
        <div className="text-center max-w-5xl mx-auto mb-20 relative z-30">
          <h2 className="text-5xl md:text-7xl lg:text-[5rem] font-black tracking-tighter mb-6 text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] leading-[1.1]">
            Ask Once • Get All AI<br />Answers Side-by-Side
          </h2>
          
          <h3 className="text-3xl md:text-4xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] flex items-center justify-center gap-4">
            <Zap className="w-8 h-8 text-cyan-400 fill-cyan-400 filter drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            Now Powered by Grok Live
          </h3>
          
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed font-medium mb-12 drop-shadow-md">
            Compare 10+ top AI models instantly — <strong className="text-white font-bold drop-shadow-[0_0_5px_rgba(255,255,255,0.8)]">GPT-4o, Claude Sonnet 4, Gemini 2.5 Flash, and Grok-4</strong> with real-time X data, trends, and live verification. The smartest way to search, analyze, and trust AI.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Link
              to="/cleanseek-x"
              className="group relative w-full sm:w-auto px-10 py-5 rounded-2xl font-black text-lg bg-cyan-500 text-[#050B14] overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_40px_rgba(6,182,212,0.6)] border-none"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-300 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.4)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:200%_0,0_0] bg-no-repeat transition-[background-position_0s_ease] group-hover:bg-[position:-100%_0,0_0] group-hover:duration-[1500ms]"></div>
              <span className="relative flex items-center justify-center gap-3">
                Try Grok Live CleanSeek
                <Zap size={22} className="fill-[#050B14]" />
              </span>
            </Link>
            <button className="group relative w-full sm:w-auto px-10 py-5 rounded-2xl font-bold text-lg border-2 border-slate-700 bg-slate-900/40 text-white backdrop-blur-md transition-all hover:bg-slate-800/80 hover:border-slate-500 hover:shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <span className="relative flex items-center justify-center gap-3">
                <Play size={22} className="text-cyan-400 group-hover:text-cyan-300 transition-colors fill-cyan-400/20" /> Watch Grok Live Demo
              </span>
            </button>
          </div>
          
          <div className="mt-8 text-sm text-slate-300">
            Sign up and pay in under a minute. You’ll verify with a secure email link before checkout.
          </div>
        </div>

        {/* Mockup Dashboard */}
        <div className="relative mt-24 perspective-1000 z-20">
          
          {/* Dashboard Container */}
          <div className="relative mx-auto max-w-[1300px] rounded-3xl bg-[#0A1128]/80 border border-slate-700/60 backdrop-blur-2xl shadow-[0_30px_100px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(34,211,238,0.1)] overflow-hidden p-3 transform-gpu" style={{ transform: 'rotateX(2deg) translateY(0)' }}>
            
            {/* Top Bar */}
            <div className="flex items-center gap-4 p-4 border-b border-slate-700/50 bg-[#050B14]/80 rounded-t-2xl shadow-inner">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-red-500/80 border border-red-500"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80 border border-yellow-500"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-green-500/80 border border-green-500"></div>
              </div>
              <div className="flex-1 max-w-3xl mx-auto flex items-center bg-[#0A1128] rounded-xl px-5 py-2.5 border border-slate-700/80 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                <Search className="w-5 h-5 text-cyan-500 mr-3" />
                <span className="text-sm font-medium text-slate-300 tracking-wide">Compare impact of solid-state batteries on EV market trends and stock sentiment today...</span>
              </div>
              <div className="flex items-center gap-3 opacity-70">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700"><Shield size={14} className="text-slate-400" /></div>
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700"><Globe size={14} className="text-slate-400" /></div>
              </div>
            </div>
            
            {/* Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-5 min-h-[550px] bg-gradient-to-b from-[#0A1128]/50 to-[#050B14]/80">
              
              {/* Tavily Card */}
              <ModelCard 
                color="yellow"
                name="Tavily" 
                icon={<Activity className="w-5 h-5" />}
                content={
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Web Search Analysis</p>
                    <div className="space-y-3">
                      <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full w-3/4 bg-yellow-500/50"></div></div>
                      <div className="h-2.5 w-5/6 bg-slate-800 rounded-full overflow-hidden"><div className="h-full w-full bg-yellow-500/30"></div></div>
                      <div className="h-2.5 w-4/6 bg-slate-800 rounded-full overflow-hidden"><div className="h-full w-1/2 bg-yellow-500/40"></div></div>
                    </div>
                    <div className="mt-6 p-3 bg-slate-900/80 rounded-xl border border-slate-700/80 text-[11px] text-slate-300 leading-relaxed shadow-inner">
                      Found 14 sources indicating a 30% increase in energy density by 2026. Major suppliers are preparing tooling for Q3 2025.
                    </div>
                  </>
                }
              />

              {/* ChatGPT Card */}
              <ModelCard 
                color="green"
                name="ChatGPT" 
                icon={<Bot className="w-5 h-5" />}
                content={
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Structured Breakdown</p>
                    <ul className="text-[11px] text-slate-200 space-y-2.5 list-none">
                      <li className="flex items-start gap-2"><Check size={14} className="text-emerald-400 shrink-0 mt-0.5" /> <span>Range increase (up to 600+ miles)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="text-emerald-400 shrink-0 mt-0.5" /> <span>Faster charging (10-15 mins)</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="text-emerald-400 shrink-0 mt-0.5" /> <span>Improved safety profile</span></li>
                      <li className="flex items-start gap-2"><Check size={14} className="text-emerald-400 shrink-0 mt-0.5" /> <span>Lower long-term costs</span></li>
                    </ul>
                    <div className="mt-5 h-20 w-full bg-gradient-to-b from-slate-800 to-transparent rounded-xl border border-slate-800/50"></div>
                  </>
                }
              />

              {/* Claude Card */}
              <ModelCard 
                color="orange"
                name="Claude" 
                icon={<Layers className="w-5 h-5" />}
                content={
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Nuanced Perspective</p>
                    <p className="text-[11.5px] text-slate-300 leading-relaxed font-medium">
                      While solid-state batteries promise transformative benefits for EVs, manufacturing at scale remains a significant hurdle. Current cost models suggest mass adoption won't occur until roughly 2028-2030, despite recent prototype successes. The supply chain for solid electrolytes requires entirely new infrastructure.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-[9px] border border-orange-500/20">Manufacturing</span>
                      <span className="px-2 py-1 rounded bg-orange-500/10 text-orange-400 text-[9px] border border-orange-500/20">Timeline</span>
                    </div>
                  </>
                }
              />

              {/* Gemini Card */}
              <ModelCard 
                color="blue"
                name="Gemini" 
                icon={<Sparkles className="w-5 h-5" />}
                content={
                  <>
                    <p className="text-xs font-semibold text-slate-400 mb-3 tracking-wider uppercase">Market Integration</p>
                    <div className="flex items-end gap-1.5 h-24 mt-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                      <div className="flex-1 bg-blue-500/30 h-1/3 rounded-t border-t border-blue-400/50 transition-all hover:bg-blue-500/50 relative group"><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] opacity-0 group-hover:opacity-100 text-blue-300">2025</span></div>
                      <div className="flex-1 bg-blue-500/50 h-1/2 rounded-t border-t border-blue-400/50 transition-all hover:bg-blue-500/70 relative group"><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] opacity-0 group-hover:opacity-100 text-blue-300">2026</span></div>
                      <div className="flex-1 bg-blue-500/70 h-3/4 rounded-t border-t border-blue-400 transition-all hover:bg-blue-400 relative group"><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] opacity-0 group-hover:opacity-100 text-blue-300">2027</span></div>
                      <div className="flex-1 bg-blue-400 h-full rounded-t border-t border-blue-300 transition-all hover:bg-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.5)] relative group"><span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] opacity-0 group-hover:opacity-100 text-blue-300">2028</span></div>
                    </div>
                    <p className="text-[10px] text-center font-medium text-slate-400 mt-3 uppercase tracking-wider">Projected Growth (Billion $)</p>
                  </>
                }
              />

              {/* Grok Card - HIGHLIGHTED */}
              <div className="relative group rounded-2xl border-2 border-red-500/70 bg-[#0A1128] overflow-hidden flex flex-col transform-gpu transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(239,68,68,0.2)] z-10" style={{ animation: 'pulse-glow 3s infinite' }}>
                <div className="absolute inset-0 bg-gradient-to-b from-red-500/15 via-transparent to-red-500/5 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"></div>
                
                <div className="p-4 border-b border-red-500/40 flex items-center justify-between bg-black/60 backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <span className="font-black text-white text-base tracking-wide drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Grok</span>
                    <span className="font-black text-white text-sm bg-black px-1.5 py-0.5 rounded border border-slate-700">X</span>
                  </div>
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-green-500/20 border border-green-500/50 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-100"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] font-black text-green-400 tracking-widest uppercase">LIVE</span>
                  </div>
                </div>
                
                <div className="p-4 flex-1 overflow-hidden relative flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Live Sentiment & News</p>
                    <Activity className="w-4 h-4 text-red-400" />
                  </div>
                  
                  {/* Real X Post Mockup */}
                  <div className="bg-[#15202B] rounded-xl p-3 border border-slate-700 shadow-lg mb-3 relative overflow-hidden group-hover:border-red-500/30 transition-colors">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent"></div>
                    <div className="flex items-center gap-2.5 mb-2 relative z-10">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 p-[1px]">
                        <div className="w-full h-full bg-black rounded-full border border-black"></div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white flex items-center gap-1">EV Tech Daily <Check size={10} className="text-cyan-400 bg-black rounded-full" /></p>
                        <p className="text-[9px] text-slate-400">@evtech • 2m</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed relative z-10">
                      Breaking: Major auto manufacturer just announced a breakthrough in solid-state battery yields. Production timeline accelerated by 2 years! 🔋⚡ <span className="text-cyan-400 hover:underline cursor-pointer">#EV</span> <span className="text-cyan-400 hover:underline cursor-pointer">#SolidState</span>
                    </p>
                  </div>
                  
                  {/* Real X Post Mockup 2 */}
                  <div className="bg-[#15202B] rounded-xl p-3 border border-slate-700 shadow-lg mb-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-[1px]">
                         <div className="w-full h-full bg-black rounded-full border border-black"></div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">Market Watch</p>
                        <p className="text-[9px] text-slate-400">@mktwatch • 5m</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-200 leading-relaxed">
                      Lithium stocks moving pre-market on the solid-state battery news. $LIT up 4.2% in early trading. <span className="text-cyan-400 hover:underline cursor-pointer">$TSLA</span> <span className="text-cyan-400 hover:underline cursor-pointer">$QS</span>
                    </p>
                  </div>
                  
                  <div className="mt-auto pt-3 border-t border-slate-700/80 bg-black/20 -mx-4 -mb-4 p-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold uppercase tracking-wider">Market Trend:</span>
                      <span className="text-green-400 font-black flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded border border-green-500/20">
                        SURGING <Activity size={12} strokeWidth={3} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          {/* Dashboard Glow Behind */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] bg-gradient-to-b from-cyan-600/10 via-purple-600/10 to-transparent blur-[80px] -z-10 rounded-[100%] pointer-events-none"></div>
        </div>

      </main>

    </div>
  )
}

function ModelCard({ color, name, icon, content }: { color: 'yellow' | 'green' | 'orange' | 'blue', name: string, icon: React.ReactNode, content: React.ReactNode }) {
  const colorMap = {
    yellow: 'border-yellow-500/30 bg-[#0A1128]/80 shadow-[inset_0_0_20px_rgba(234,179,8,0.05)] hover:border-yellow-500/50',
    green: 'border-emerald-500/30 bg-[#0A1128]/80 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)] hover:border-emerald-500/50',
    orange: 'border-orange-500/30 bg-[#0A1128]/80 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)] hover:border-orange-500/50',
    blue: 'border-blue-500/30 bg-[#0A1128]/80 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)] hover:border-blue-500/50'
  }
  
  const headerColorMap = {
    yellow: 'text-yellow-400 bg-yellow-400/10',
    green: 'text-emerald-400 bg-emerald-400/10',
    orange: 'text-orange-400 bg-orange-400/10',
    blue: 'text-blue-400 bg-blue-400/10'
  }

  return (
    <div className={`rounded-2xl border ${colorMap[color]} overflow-hidden flex flex-col backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group`}>
      <div className="p-4 border-b border-slate-700/50 flex items-center gap-3 bg-black/40">
        <div className={`p-1.5 rounded-lg ${headerColorMap[color]}`}>{icon}</div>
        <span className="font-bold text-white text-base tracking-wide">{name}</span>
      </div>
      <div className="p-4 flex-1 overflow-hidden flex flex-col group-hover:bg-white/[0.02] transition-colors">
        {content}
      </div>
    </div>
  )
}

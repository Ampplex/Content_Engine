import React from 'react';
import { Activity, BrainCircuit, LineChart } from 'lucide-react';

/**
 * Sticky top navigation bar with logo, tab switcher, and connection status.
 */
export default function Header({ tab, onTabChange }) {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-xl border-b border-indigo-400/20 shadow-[0_8px_30px_rgba(31,41,55,0.45)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center border border-indigo-200/30 shadow-[0_0_16px_rgba(129,140,248,0.6)]">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight text-white">Content Engine</h1>
            <p className="text-[11px] text-indigo-100/70 font-medium -mt-0.5 tracking-wide">AI-Powered Marketing Content Generator</p>
          </div>
        </div>

        <div className="flex bg-slate-900/70 p-1 rounded-xl border border-indigo-300/30 shadow-inner">
          <button
            onClick={() => onTabChange('generator')}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
              tab === 'generator'
                ? 'bg-indigo-500/25 shadow-[0_0_12px_rgba(129,140,248,0.5)] text-indigo-100 border border-indigo-300/50'
                : 'text-indigo-100/70 hover:text-indigo-100'
            }`}
          >
            <BrainCircuit className="w-4 h-4" /> Content Engine
          </button>
          <button
            onClick={() => onTabChange('copilot')}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
              tab === 'copilot'
                ? 'bg-indigo-500/25 shadow-[0_0_12px_rgba(129,140,248,0.5)] text-indigo-100 border border-indigo-300/50'
                : 'text-indigo-100/70 hover:text-indigo-100'
            }`}
          >
            <LineChart className="w-4 h-4" /> Growth Copilot
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-400/10 text-emerald-200 px-3 py-1.5 rounded-full font-medium border border-emerald-300/30">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
            Bedrock Connected
          </span>
        </div>
      </div>
    </header>
  );
}

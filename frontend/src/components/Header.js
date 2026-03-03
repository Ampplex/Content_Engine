import React from 'react';
import { Activity, BrainCircuit, LineChart } from 'lucide-react';

/**
 * Sticky top navigation bar with logo, tab switcher, and connection status.
 */
export default function Header({ tab, onTabChange }) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">Content Engine</h1>
            <p className="text-[11px] text-slate-400 font-medium -mt-0.5 tracking-wide">AI for Bharat • Content Engine</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          <button
            onClick={() => onTabChange('generator')}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
              tab === 'generator' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <BrainCircuit className="w-4 h-4" /> Content Engine
          </button>
          <button
            onClick={() => onTabChange('copilot')}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
              tab === 'copilot' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LineChart className="w-4 h-4" /> Growth Copilot
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium border border-emerald-200/60">
            <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
            Bedrock Connected
          </span>
        </div>
      </div>
    </header>
  );
}

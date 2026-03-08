import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

export function ScoreBar({ label, score, color, weight, theme = 'dark' }) {
  const isDark = theme === 'dark';
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className={`text-sm font-medium ${isDark ? 'text-indigo-100/90' : 'text-slate-700'}`}>{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono ${isDark ? 'text-indigo-100/55' : 'text-slate-500'}`}>w={weight}</span>
          <span className={`text-sm font-semibold ${isDark ? 'text-indigo-50' : 'text-slate-800'}`}>{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className={`w-full rounded-full h-2.5 overflow-hidden border ${isDark ? 'bg-indigo-100/10 border-indigo-200/15' : 'bg-slate-100 border-slate-200'}`}>
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${color} ${isDark ? 'shadow-[0_0_14px_rgba(139,92,246,0.6)]' : ''}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PipelineStep({ step, status, detail, isLast, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const Icon = step.icon;
  const isActive = status === 'active';
  const isDone = status === 'done';
  const tileClasses = isDark
    ? (isDone
      ? 'border-emerald-300/45 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
      : isActive
        ? 'border-cyan-300/60 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.32)]'
        : 'border-indigo-300/25 bg-indigo-950/35')
    : (isDone
      ? 'border-emerald-200 bg-emerald-50'
      : isActive
        ? 'border-cyan-200 bg-cyan-50'
        : 'border-slate-200 bg-white');

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-300 ${tileClasses} ${isLast ? '' : 'mb-2'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-[0_0_12px_rgba(56,189,248,0.45)] ${
          isDone ? 'bg-emerald-500 border-emerald-400 text-white' :
          isActive ? 'bg-cyan-500 border-cyan-300 text-white step-pulse' :
          (isDark ? 'bg-indigo-950/70 border-cyan-300/40 text-cyan-200/70' : 'bg-slate-100 border-slate-300 text-slate-500')
        }`}>
        {isDone ? <CheckCircle className="w-4 h-4" /> :
          isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
          <Icon className="w-4 h-4" />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${isDone ? (isDark ? 'text-indigo-50' : 'text-slate-900') : isActive ? (isDark ? 'text-cyan-100' : 'text-cyan-800') : (isDark ? 'text-indigo-100/65' : 'text-slate-600')}`}>
          {step.label}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isDone ? (isDark ? 'text-indigo-100/80' : 'text-slate-600') : isActive ? (isDark ? 'text-cyan-100/80' : 'text-cyan-700') : (isDark ? 'text-indigo-100/45' : 'text-slate-500')}`}>
          {detail || step.desc}
        </p>
      </div>
    </div>
  );
}

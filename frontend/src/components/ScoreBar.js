import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

export function ScoreBar({ label, score, color, weight }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-indigo-100/90">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-indigo-100/55 font-mono">w={weight}</span>
          <span className="text-sm font-semibold text-indigo-50">{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full bg-indigo-100/10 rounded-full h-2.5 overflow-hidden border border-indigo-200/15">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${color} shadow-[0_0_14px_rgba(139,92,246,0.6)]`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

export function PipelineStep({ step, status, detail, isLast }) {
  const Icon = step.icon;
  const isActive = status === 'active';
  const isDone = status === 'done';
  const tileClasses = isDone
    ? 'border-emerald-300/45 bg-emerald-500/10 shadow-[0_0_16px_rgba(16,185,129,0.2)]'
    : isActive
      ? 'border-cyan-300/60 bg-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.32)]'
      : 'border-indigo-300/25 bg-indigo-950/35';

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-300 ${tileClasses} ${isLast ? '' : 'mb-2'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-[0_0_12px_rgba(56,189,248,0.45)] ${
          isDone ? 'bg-emerald-500 border-emerald-400 text-white' :
          isActive ? 'bg-cyan-500 border-cyan-300 text-white step-pulse' :
          'bg-indigo-950/70 border-cyan-300/40 text-cyan-200/70'
        }`}>
        {isDone ? <CheckCircle className="w-4 h-4" /> :
          isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
          <Icon className="w-4 h-4" />}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${isDone ? 'text-indigo-50' : isActive ? 'text-cyan-100' : 'text-indigo-100/65'}`}>
          {step.label}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isDone ? 'text-indigo-100/80' : isActive ? 'text-cyan-100/80' : 'text-indigo-100/45'}`}>
          {detail || step.desc}
        </p>
      </div>
    </div>
  );
}

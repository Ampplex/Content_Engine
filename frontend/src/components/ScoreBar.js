import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';

export function ScoreBar({ label, score, color, weight }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">w={weight}</span>
          <span className="text-sm font-semibold text-slate-800">{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
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

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
          isActive ? 'bg-indigo-500 border-indigo-500 text-white animate-pulse' :
          'bg-white border-slate-200 text-slate-400'
        }`}>
          {isDone ? <CheckCircle className="w-4 h-4" /> :
           isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
           <Icon className="w-4 h-4" />}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-grow min-h-[24px] transition-colors duration-300 ${
            isDone ? 'bg-emerald-300' : 'bg-slate-200'
          }`} />
        )}
      </div>
      <div className="pb-5">
        <p className={`text-sm font-semibold ${isDone ? 'text-slate-800' : isActive ? 'text-indigo-700' : 'text-slate-400'}`}>
          {step.label}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isDone ? 'text-slate-600' : isActive ? 'text-indigo-500' : 'text-slate-300'}`}>
          {detail || step.desc}
        </p>
      </div>
    </div>
  );
}

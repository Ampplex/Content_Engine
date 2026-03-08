import React from 'react';
import { BarChart3 } from 'lucide-react';

function Bar({ label, score, color, weight }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono">w={weight}</span>
          <span className="text-sm font-bold text-slate-800">{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${color}`} style={{ width: `${score * 100}%` }} />
      </div>
    </div>
  );
}

export default function IGScoringPanel({ result, partialScores }) {
  const scores = result?.scores || partialScores;

  return (
    <div className="lg:col-span-4">
      <div className="ui-card overflow-hidden h-full flex flex-col">
        <div className="ui-card-header">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
            <BarChart3 className="w-4 h-4 text-pink-600" /> Engagement Score
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">0.5*ML + 0.3*LLM + 0.2*Heuristic</p>
        </div>

        <div className="p-5 flex-grow">
          {scores ? (
            <>
              <Bar label="LightGBM Caption ML" score={scores.ml} color="bg-pink-500" weight="0.5" />
              <Bar label="LLM Virality Evaluator" score={scores.llm} color="bg-fuchsia-500" weight="0.3" />
              <Bar label="Heuristics Engine" score={scores.heuristic} color="bg-amber-400" weight="0.2" />

              <div className="border-t border-dashed border-slate-200 my-5" />

              <div className="text-center mb-5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Predicted Engagement</p>
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke={scores.final >= 0.75 ? '#db2777' : '#d97706'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${scores.final * 314.16} 314.16`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-slate-900">{(scores.final * 100).toFixed(0)}</span>
                </div>
                <p className={`text-sm font-bold mt-2 ${
                  scores.final >= 0.85 ? 'text-emerald-600' : scores.final >= 0.75 ? 'text-pink-600' : 'text-amber-600'
                }`}>
                  {scores.final >= 0.85 ? 'High viral potential' : scores.final >= 0.75 ? 'Good engagement' : 'Needs improvement'}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Formula</p>
                <p className="text-xs text-slate-600 font-mono leading-loose">
                  (0.5 x {(scores.ml * 100).toFixed(1)})<br />
                  + (0.3 x {(scores.llm * 100).toFixed(1)})<br />
                  + (0.2 x {(scores.heuristic * 100).toFixed(1)})<br />
                  = <span className="font-bold text-pink-600">{(scores.final * 100).toFixed(1)}</span>
                </p>
              </div>

              {scores.ml_top_importances && Object.keys(scores.ml_top_importances).length > 0 && (
                <div className="bg-pink-50/60 rounded-xl p-4 border border-pink-100">
                  <p className="text-[10px] font-bold text-pink-600 uppercase mb-3">Top Caption Features</p>
                  <div className="space-y-2.5">
                    {Object.entries(scores.ml_top_importances).map(([feat, imp]) => {
                      const val = scores.ml_features?.[feat];
                      const max = Math.max(...Object.values(scores.ml_top_importances));
                      return (
                        <div key={feat}>
                          <div className="flex justify-between mb-0.5">
                            <span className="text-[11px] text-slate-600 font-medium">{feat.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {val !== undefined ? (typeof val === 'number' && !Number.isInteger(val) ? val.toFixed(2) : val) : ''}
                            </span>
                          </div>
                          <div className="w-full bg-pink-100 rounded-full h-1.5">
                            <div className="h-full rounded-full bg-pink-400 transition-all duration-700" style={{ width: `${(imp / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-16">
              <BarChart3 className="w-12 h-12" />
              <p className="text-sm font-medium text-slate-400">Scores appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

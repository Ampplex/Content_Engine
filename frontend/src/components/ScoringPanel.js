import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ScoreBar } from './ScoreBar';

/**
 * Middle column: Hybrid scoring breakdown with score bars,
 * donut chart, formula, and LightGBM feature insights.
 */
export default function ScoringPanel({ result, partialScores, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const scores = result?.scores || partialScores;

  return (
    <div className="lg:col-span-4">
      <div className={`${isDark ? 'panel-glow-purple bg-[#0b0a36]/85 shadow-[0_0_34px_rgba(217,70,239,0.24)] border-fuchsia-300/45 backdrop-blur-sm' : 'bg-white shadow-sm border-slate-200/70'} rounded-2xl border overflow-hidden h-full flex flex-col`}>
        <div className={`px-5 py-4 border-b ${isDark ? 'border-fuchsia-300/30 bg-gradient-to-r from-fuchsia-500/15 via-indigo-500/10 to-violet-500/15' : 'border-slate-200 bg-slate-50'}`}>
          <h2 className={`font-semibold text-sm flex items-center gap-2 ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>
            <BarChart3 className={`w-4 h-4 ${isDark ? 'text-fuchsia-300' : 'text-fuchsia-600'}`} />
            Hybrid Scoring Breakdown
          </h2>
          <p className={`text-[11px] mt-1 font-mono ${isDark ? 'text-indigo-100/55' : 'text-slate-500'}`}>
            score = 0.5·ML + 0.3·LLM + 0.2·Heuristic
          </p>
        </div>

        <div className={`p-5 flex-grow ${isDark ? 'bg-[radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.14),transparent_45%),radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.14),transparent_45%)]' : 'bg-white'}`}>
          {scores ? (
            <>
              <ScoreBar theme={theme} label="ML Feature Predictor" score={scores.ml} color="from-blue-400 to-violet-400" weight="0.5" />
              <ScoreBar theme={theme} label="LLM Engagement Evaluator" score={scores.llm} color="from-violet-400 to-fuchsia-400" weight="0.3" />
              <ScoreBar theme={theme} label="Heuristics Engine" score={scores.heuristic} color="from-amber-400 to-orange-400" weight="0.2" />

              <div className={`border-t border-dashed my-6 ${isDark ? 'border-indigo-300/20' : 'border-slate-200'}`} />

              <div className="text-center">
                <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>
                  Predicted Engagement Score
                </p>
                <div className="relative flex justify-center">
                  <svg width="170" height="100" viewBox="0 0 140 95" className="overflow-visible">
                    <defs>
                      <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#d946ef" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 20 70 A 50 50 0 0 1 120 70"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="10"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20 70 A 50 50 0 0 1 120 70"
                      fill="none"
                      stroke="url(#gaugeGrad)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${Math.PI * 50}`}
                      strokeDashoffset={`${Math.PI * 50 * (1 - scores.final)}`}
                      className="transition-all duration-1000"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(217,70,239,0.7))' }}
                    />
                    <text
                      x="70"
                      y="58"
                      textAnchor="middle"
                      fill="white"
                      fontSize="28"
                      fontWeight="800"
                    >
                      {(scores.final * 100).toFixed(0)}
                    </text>
                  </svg>
                </div>
                <p className={`text-sm font-semibold mt-2 ${scores.final >= 0.75 ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-amber-300' : 'text-amber-700')}`}>
                  {scores.final >= 0.85 ? 'Excellent — Ready to publish' :
                   scores.final >= 0.75 ? 'Good — Passed quality gate' :
                   'Below threshold — Reflexion triggered'}
                </p>
              </div>

              <div className={`mt-6 rounded-xl p-4 border ${isDark ? 'bg-slate-950/45 border-indigo-300/30 shadow-[inset_0_0_12px_rgba(129,140,248,0.15)]' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>Calculation</p>
                <p className={`text-xs font-mono leading-loose ${isDark ? 'text-indigo-100/80' : 'text-slate-700'}`}>
                  (0.5 × {(scores.ml * 100).toFixed(1)}) + (0.3 × {(scores.llm * 100).toFixed(1)}) + (0.2 × {(scores.heuristic * 100).toFixed(1)})<br />
                  = <span className={`font-bold ${isDark ? 'text-indigo-200' : 'text-slate-900'}`}>{(scores.final * 100).toFixed(1)}</span>
                </p>
              </div>

              {scores.ml_top_importances && Object.keys(scores.ml_top_importances).length > 0 && (
                <div className={`mt-4 rounded-xl p-4 border ${isDark ? 'bg-blue-500/10 border-blue-300/30 shadow-[inset_0_0_14px_rgba(59,130,246,0.15)]' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${isDark ? 'text-blue-200' : 'text-blue-900'}`}>
                    <BarChart3 className="w-3 h-3" /> LightGBM Feature Insights
                  </p>
                  <div className="space-y-2">
                    {Object.entries(scores.ml_top_importances).map(([feature, importance]) => {
                      const featureValue = scores.ml_features?.[feature];
                      const maxImp = Math.max(...Object.values(scores.ml_top_importances));
                      const barWidth = (importance / maxImp) * 100;
                      return (
                        <div key={feature}>
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className={`text-[11px] font-medium ${isDark ? 'text-indigo-100/85' : 'text-blue-900'}`}>
                              {feature.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[10px] font-mono ${isDark ? 'text-indigo-100/60' : 'text-blue-800'}`}>
                              {featureValue !== undefined
                                ? (typeof featureValue === 'number' && !Number.isInteger(featureValue)
                                    ? featureValue.toFixed(2)
                                    : featureValue)
                                : ''}
                            </span>
                          </div>
                          <div className={`w-full rounded-full h-1.5 ${isDark ? 'bg-blue-200/20' : 'bg-blue-100'}`}>
                            <div className={`h-full rounded-full transition-all duration-700 ${isDark ? 'bg-blue-400' : 'bg-blue-600'}`} style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className={`text-[10px] mt-2 ${isDark ? 'text-blue-200/80' : 'text-blue-900'}`}>Top features by LightGBM gain importance</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-indigo-100/40 gap-3 py-12">
              <BarChart3 className="w-12 h-12" />
              <p className="text-sm font-medium">Scores will appear here</p>
              <p className="text-xs text-indigo-100/35">Waiting for pipeline to complete...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
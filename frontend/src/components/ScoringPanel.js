import React from 'react';
import { BarChart3 } from 'lucide-react';
import { ScoreBar } from './ScoreBar';

/**
 * Middle column: Hybrid scoring breakdown with score bars,
 * donut chart, formula, and LightGBM feature insights.
 */
export default function ScoringPanel({ result, partialScores }) {
  const scores = result?.scores || partialScores;

  return (
    <div className="lg:col-span-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden h-full flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            Hybrid Scoring Breakdown
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">
            score = 0.5·ML + 0.3·LLM + 0.2·Heuristic
          </p>
        </div>

        <div className="p-5 flex-grow">
          {scores ? (
            <>
              <ScoreBar label="ML Feature Predictor" score={scores.ml} color="bg-blue-500" weight="0.5" />
              <ScoreBar label="LLM Engagement Evaluator" score={scores.llm} color="bg-purple-500" weight="0.3" />
              <ScoreBar label="Heuristics Engine" score={scores.heuristic} color="bg-amber-500" weight="0.2" />

              <div className="border-t border-dashed border-slate-200 my-6" />

              {/* Final Score Donut */}
              <div className="text-center">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Predicted Engagement Score
                </p>
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-32 h-32" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={scores.final >= 0.75 ? '#6366f1' : '#f59e0b'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${scores.final * 314} 314`}
                      transform="rotate(-90 60 60)"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-slate-900">
                    {(scores.final * 100).toFixed(0)}
                  </span>
                </div>
                <p className={`text-sm font-semibold mt-2 ${scores.final >= 0.75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {scores.final >= 0.85 ? 'Excellent — Ready to publish' :
                   scores.final >= 0.75 ? 'Good — Passed quality gate' :
                   'Below threshold — Reflexion triggered'}
                </p>
              </div>

              {/* Score Formula */}
              <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Calculation</p>
                <p className="text-xs text-slate-600 font-mono leading-loose">
                  (0.5 × {(scores.ml * 100).toFixed(1)}) + (0.3 × {(scores.llm * 100).toFixed(1)}) + (0.2 × {(scores.heuristic * 100).toFixed(1)})<br />
                  = <span className="font-bold text-indigo-600">{(scores.final * 100).toFixed(1)}</span>
                </p>
              </div>

              {/* LightGBM Feature Insights */}
              {scores.ml_top_importances && Object.keys(scores.ml_top_importances).length > 0 && (
                <div className="mt-4 bg-blue-50/60 rounded-xl p-4 border border-blue-100">
                  <p className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
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
                            <span className="text-[11px] text-slate-600 font-medium">
                              {feature.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {featureValue !== undefined ? (typeof featureValue === 'number' && !Number.isInteger(featureValue) ? featureValue.toFixed(2) : featureValue) : ''}
                            </span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-1.5">
                            <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-blue-400 mt-2">Top features by LightGBM gain importance</p>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-12">
              <BarChart3 className="w-12 h-12" />
              <p className="text-sm font-medium">Scores will appear here</p>
              <p className="text-xs text-slate-300">Waiting for pipeline to complete...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

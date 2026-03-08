import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BrainCircuit, Search, Shield, AlertTriangle, Activity,
  RefreshCw
} from 'lucide-react';
import { PIPELINE_STEPS } from '../constants/pipeline';
import { PipelineStep } from './ScoreBar';

/**
 * Left column: Agentic thought process timeline, reflexion log,
 * search results & trend insights, and agent critique details.
 */
export default function AgentWorkflow({
  loading, result, currentIteration, reflexionHistory,
  searchData, partialCritiques, getStepStatus, getStepDetail, language, theme = 'dark',
}) {
  const isDark = theme === 'dark';
  const critiques = result?.critiques || partialCritiques;

  return (
    <div className="lg:col-span-4 space-y-5">
      {/* ── Thought Process Timeline ──────────────────────────────────── */}
      <div className={`${isDark ? 'panel-glow-cyan bg-[#0a0b34]/85 shadow-[0_0_30px_rgba(34,211,238,0.2)] border-cyan-300/45 backdrop-blur-sm' : 'bg-white shadow-sm border-slate-200/70'} rounded-2xl border overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${isDark ? 'border-cyan-300/30 bg-gradient-to-r from-cyan-500/20 via-indigo-500/10 to-fuchsia-500/20' : 'border-slate-200 bg-slate-50'}`}>
          <h2 className={`font-semibold text-sm flex items-center gap-2 ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>
            <BrainCircuit className={`w-4 h-4 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
            Agentic Thought Process
          </h2>
          {loading && currentIteration > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-indigo-500/20 text-indigo-200 px-2.5 py-1 rounded-md font-semibold border border-indigo-300/30">
                <RefreshCw className={`w-3 h-3 inline mr-1 ${currentIteration > 1 ? 'animate-spin' : ''}`} />
                Iteration {currentIteration}{currentIteration > 1 ? ' (Reflexion)' : ''}
              </span>
              {currentIteration > 1 && (
                <span className="text-xs text-indigo-200/80 font-medium">Refining post...</span>
              )}
            </div>
          )}
          {result && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-indigo-500/20 text-indigo-200 px-2.5 py-1 rounded-md font-semibold border border-indigo-300/30">
                <RefreshCw className="w-3 h-3 inline mr-1" />
                {result.iterations} Reflexion {result.iterations === 1 ? 'Pass' : 'Passes'}
              </span>
              <span className="text-xs text-indigo-100/60">7 agents executed</span>
            </div>
          )}
        </div>

        <div className={`p-5 ${isDark ? 'bg-[radial-gradient(circle_at_30%_10%,rgba(34,211,238,0.12),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(217,70,239,0.1),transparent_45%)]' : 'bg-white'}`}>
          {PIPELINE_STEPS.map((step, i) => (
            <PipelineStep
              key={step.id}
              step={step}
              status={getStepStatus(i)}
              detail={getStepDetail(i, language)}
              isLast={i === PIPELINE_STEPS.length - 1}
              theme={theme}
            />
          ))}
        </div>

        {/* Reflexion History */}
        {reflexionHistory.length > 0 && (
          <div className="px-5 pb-4 space-y-2">
            <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-indigo-200/70' : 'text-slate-500'}`}>Reflexion Log</p>
            {reflexionHistory.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${r.manual ? (isDark ? 'bg-blue-500/10 border-blue-300/30' : 'bg-blue-50 border-blue-200') : (isDark ? 'bg-amber-500/10 border-amber-300/30' : 'bg-amber-50 border-amber-200')}`}>
                <RefreshCw className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${r.manual ? (isDark ? 'text-blue-300' : 'text-blue-600') : (isDark ? 'text-amber-300' : 'text-amber-600')}`} />
                <div>
                  <p className={`text-xs font-semibold ${r.manual ? (isDark ? 'text-blue-200' : 'text-blue-800') : (isDark ? 'text-amber-200' : 'text-amber-800')}`}>
                    Iteration {r.iteration}: {r.manual ? 'User-triggered refinement' : `Score ${(r.previous_score * 100).toFixed(1)}% — below 75% threshold`}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${r.manual ? (isDark ? 'text-blue-100/80' : 'text-blue-700') : (isDark ? 'text-amber-100/80' : 'text-amber-700')}`}>{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search Results & Trend Insights ────────────────────────────── */}
      {searchData && (
        <div className={`${isDark ? 'bg-[#0a0b34]/80 shadow-[0_0_28px_rgba(34,211,238,0.15)] border-cyan-300/35 backdrop-blur-sm' : 'bg-white shadow-sm border-slate-200/70'} rounded-2xl border overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${isDark ? 'border-cyan-300/25' : 'border-slate-200'}`}>
            <h3 className={`font-semibold text-sm flex items-center gap-2 ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>
              <Search className={`w-4 h-4 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} />
              Web Research & Fact-Check
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {searchData.queries?.length > 0 && (
              <div className={`${isDark ? 'bg-slate-950/40 border-indigo-300/20' : 'bg-slate-50 border-slate-200'} rounded-xl p-3 border`}>
                <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-indigo-200/70' : 'text-slate-500'}`}>Search Queries</p>
                <div className="space-y-1">
                  {searchData.queries.map((q, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${isDark ? 'text-indigo-100/85' : 'text-slate-700'}`}>
                      <Search className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-indigo-200/70' : 'text-slate-400'}`} />
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchData.insights && (
              <div className={`${isDark ? 'bg-cyan-500/10 border-cyan-300/30' : 'bg-cyan-50 border-cyan-200'} rounded-xl p-3.5 border`}>
                <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 flex items-center gap-1 ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}>
                  <Activity className="w-3 h-3" /> Trend Insights
                </p>
                <div className={`text-xs leading-relaxed max-w-none prose prose-sm prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 ${isDark ? 'text-indigo-100/85 prose-invert' : 'text-slate-700'}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchData.insights}</ReactMarkdown>
                </div>
              </div>
            )}

            {searchData.results?.length > 0 && (
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isDark ? 'text-indigo-200/70' : 'text-slate-500'}`}>Sources ({searchData.results.length})</p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {searchData.results.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className={`block rounded-lg p-2.5 border transition-all group ${isDark ? 'bg-slate-950/40 hover:bg-indigo-500/10 border-indigo-300/20 hover:border-indigo-300/50' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 hover:border-slate-300'}`}>
                      <p className={`text-xs font-medium line-clamp-1 ${isDark ? 'text-indigo-100 group-hover:text-indigo-50' : 'text-slate-800'}`}>{r.title}</p>
                      <p className={`text-[10px] line-clamp-1 mt-0.5 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>{r.snippet}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Agent Critiques Detail ─────────────────────────────────────── */}
      {critiques && (
        <div className={`${isDark ? 'bg-[#0a0b34]/80 shadow-[0_0_28px_rgba(168,85,247,0.2)] border-fuchsia-300/35 backdrop-blur-sm' : 'bg-white shadow-sm border-slate-200/70'} rounded-2xl border overflow-hidden`}>
          <div className={`px-5 py-4 border-b ${isDark ? 'border-fuchsia-300/25' : 'border-slate-200'}`}>
            <h3 className={`font-semibold text-sm flex items-center gap-2 ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>
              <Shield className={`w-4 h-4 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
              Agent Review Details
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {critiques.map((critique, i) => {
              const icons = [Search, Shield, AlertTriangle];
              const colors = isDark
                ? ['text-blue-300', 'text-purple-300', 'text-amber-300']
                : ['text-blue-700', 'text-purple-700', 'text-amber-700'];
              const bgColors = isDark
                ? ['bg-blue-500/10 border-blue-300/30', 'bg-purple-500/10 border-purple-300/30', 'bg-amber-500/10 border-amber-300/30']
                : ['bg-blue-50 border-blue-200', 'bg-purple-50 border-purple-200', 'bg-amber-50 border-amber-200'];
              const Icon = icons[i];
              return (
                <div key={i} className={`${bgColors[i]} rounded-xl p-3.5 border`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors[i]}`} />
                    <p className={`text-xs leading-relaxed ${isDark ? 'text-indigo-100/85' : 'text-slate-700'}`}>{critique}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
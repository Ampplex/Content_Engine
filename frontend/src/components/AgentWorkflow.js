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
  searchData, partialCritiques, getStepStatus, getStepDetail, language,
}) {
  const critiques = result?.critiques || partialCritiques;

  return (
    <div className="lg:col-span-4 space-y-5">
      {/* ── Thought Process Timeline ──────────────────────────────────── */}
      <div className="panel-glow-cyan bg-[#0a0b34]/85 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.2)] border border-cyan-300/45 overflow-hidden backdrop-blur-sm">
        <div className="px-5 py-4 border-b border-cyan-300/30 bg-gradient-to-r from-cyan-500/20 via-indigo-500/10 to-fuchsia-500/20">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-indigo-100">
            <BrainCircuit className="w-4 h-4 text-cyan-300" />
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

        <div className="p-5 bg-[radial-gradient(circle_at_30%_10%,rgba(34,211,238,0.12),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(217,70,239,0.1),transparent_45%)]">
          {PIPELINE_STEPS.map((step, i) => (
            <PipelineStep
              key={step.id}
              step={step}
              status={getStepStatus(i)}
              detail={getStepDetail(i, language)}
              isLast={i === PIPELINE_STEPS.length - 1}
            />
          ))}
        </div>

        {/* Reflexion History */}
        {reflexionHistory.length > 0 && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-[11px] font-semibold text-indigo-200/70 uppercase tracking-wider">Reflexion Log</p>
            {reflexionHistory.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 ${r.manual ? 'bg-blue-500/10 border-blue-300/30' : 'bg-amber-500/10 border-amber-300/30'} border rounded-lg px-3 py-2`}>
                <RefreshCw className={`w-3.5 h-3.5 ${r.manual ? 'text-blue-300' : 'text-amber-300'} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-semibold ${r.manual ? 'text-blue-200' : 'text-amber-200'}`}>
                    Iteration {r.iteration}: {r.manual ? 'User-triggered refinement' : `Score ${(r.previous_score * 100).toFixed(1)}% — below 75% threshold`}
                  </p>
                  <p className={`text-[11px] ${r.manual ? 'text-blue-100/80' : 'text-amber-100/80'} mt-0.5`}>{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search Results & Trend Insights ────────────────────────────── */}
      {searchData && (
        <div className="bg-[#0a0b34]/80 rounded-2xl shadow-[0_0_28px_rgba(34,211,238,0.15)] border border-cyan-300/35 overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-cyan-300/25">
            <h3 className="font-semibold text-sm text-indigo-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-300" />
              Web Research & Fact-Check
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {searchData.queries?.length > 0 && (
              <div className="bg-slate-950/40 rounded-xl p-3 border border-indigo-300/20">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-200/70 mb-2">Search Queries</p>
                <div className="space-y-1">
                  {searchData.queries.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-indigo-100/85">
                      <Search className="w-3 h-3 text-indigo-200/70 flex-shrink-0" />
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchData.insights && (
              <div className="bg-cyan-500/10 rounded-xl p-3.5 border border-cyan-300/30">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-cyan-200 mb-2 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Trend Insights
                </p>
                <div className="text-xs text-indigo-100/85 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchData.insights}</ReactMarkdown>
                </div>
              </div>
            )}

            {searchData.results?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-indigo-200/70 mb-2">Sources ({searchData.results.length})</p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {searchData.results.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="block bg-slate-950/40 hover:bg-indigo-500/10 rounded-lg p-2.5 border border-indigo-300/20 hover:border-indigo-300/50 transition-all group">
                      <p className="text-xs font-medium text-indigo-100 group-hover:text-indigo-50 line-clamp-1">{r.title}</p>
                      <p className="text-[10px] text-indigo-100/60 line-clamp-1 mt-0.5">{r.snippet}</p>
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
        <div className="bg-[#0a0b34]/80 rounded-2xl shadow-[0_0_28px_rgba(168,85,247,0.2)] border border-fuchsia-300/35 overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-fuchsia-300/25">
            <h3 className="font-semibold text-sm text-indigo-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-300" />
              Agent Review Details
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {critiques.map((critique, i) => {
              const icons = [Search, Shield, AlertTriangle];
              const colors = ['text-blue-300', 'text-purple-300', 'text-amber-300'];
              const bgColors = ['bg-blue-500/10 border-blue-300/30', 'bg-purple-500/10 border-purple-300/30', 'bg-amber-500/10 border-amber-300/30'];
              const Icon = icons[i];
              return (
                <div key={i} className={`${bgColors[i]} rounded-xl p-3.5 border`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors[i]}`} />
                    <p className="text-xs text-indigo-100/85 leading-relaxed">{critique}</p>
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

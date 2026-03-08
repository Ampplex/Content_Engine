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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
            <BrainCircuit className="w-4 h-4 text-indigo-600" />
            Agentic Thought Process
          </h2>
          {loading && currentIteration > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md font-semibold">
                <RefreshCw className={`w-3 h-3 inline mr-1 ${currentIteration > 1 ? 'animate-spin' : ''}`} />
                Iteration {currentIteration}{currentIteration > 1 ? ' (Reflexion)' : ''}
              </span>
              {currentIteration > 1 && (
                <span className="text-xs text-indigo-500 font-medium">Refining post...</span>
              )}
            </div>
          )}
          {result && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md font-semibold">
                <RefreshCw className="w-3 h-3 inline mr-1" />
                {result.iterations} Reflexion {result.iterations === 1 ? 'Pass' : 'Passes'}
              </span>
              <span className="text-xs text-slate-400">7 agents executed</span>
            </div>
          )}
        </div>

        <div className="p-5">
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
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Reflexion Log</p>
            {reflexionHistory.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 ${r.manual ? 'bg-blue-50 border-blue-200/60' : 'bg-amber-50 border-amber-200/60'} border rounded-lg px-3 py-2`}>
                <RefreshCw className={`w-3.5 h-3.5 ${r.manual ? 'text-blue-500' : 'text-amber-500'} mt-0.5 flex-shrink-0`} />
                <div>
                  <p className={`text-xs font-semibold ${r.manual ? 'text-blue-700' : 'text-amber-700'}`}>
                    Iteration {r.iteration}: {r.manual ? 'User-triggered refinement' : `Score ${(r.previous_score * 100).toFixed(1)}% — below 75% threshold`}
                  </p>
                  <p className={`text-[11px] ${r.manual ? 'text-blue-600' : 'text-amber-600'} mt-0.5`}>{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search Results & Trend Insights ────────────────────────────── */}
      {searchData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-500" />
              Web Research & Fact-Check
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {searchData.queries?.length > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Search Queries</p>
                <div className="space-y-1">
                  {searchData.queries.map((q, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <Search className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span>{q}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchData.insights && (
              <div className="bg-cyan-50 rounded-xl p-3.5 border border-cyan-100">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-cyan-600 mb-2 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Trend Insights
                </p>
                <div className="text-xs text-slate-700 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{searchData.insights}</ReactMarkdown>
                </div>
              </div>
            )}

            {searchData.results?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">Sources ({searchData.results.length})</p>
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {searchData.results.map((r, i) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="block bg-slate-50 hover:bg-indigo-50 rounded-lg p-2.5 border border-slate-100 hover:border-indigo-200 transition-all group">
                      <p className="text-xs font-medium text-slate-700 group-hover:text-indigo-700 line-clamp-1">{r.title}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{r.snippet}</p>
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
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              Agent Review Details
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {critiques.map((critique, i) => {
              const icons = [Search, Shield, AlertTriangle];
              const colors = ['text-blue-500', 'text-purple-500', 'text-amber-500'];
              const bgColors = ['bg-blue-50', 'bg-purple-50', 'bg-amber-50'];
              const Icon = icons[i];
              return (
                <div key={i} className={`${bgColors[i]} rounded-xl p-3.5 border border-slate-100`}>
                  <div className="flex items-start gap-2.5">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors[i]}`} />
                    <p className="text-xs text-slate-700 leading-relaxed">{critique}</p>
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
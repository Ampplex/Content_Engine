import React from 'react';
import {
  BrainCircuit, Search, Shield, AlertTriangle, Activity,
  Hash, RefreshCw, CheckCircle, Loader2,
} from 'lucide-react';
import { IG_PIPELINE_STEPS } from '../constants/ig_pipeline';

function PipelineStep({ step, status, detail, isLast }) {
  const Icon    = step.icon;
  const isActive = status === 'active';
  const isDone   = status === 'done';
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
          isDone   ? 'bg-pink-500 border-pink-500 text-white'
          : isActive ? 'bg-fuchsia-500 border-fuchsia-400 text-white animate-pulse'
          : 'bg-white border-slate-200 text-slate-400'
        }`}>
          {isDone   ? <CheckCircle className="w-4 h-4" />
           : isActive ? <Loader2 className="w-4 h-4 animate-spin" />
           : <Icon className="w-4 h-4" />}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-grow min-h-[24px] transition-colors ${isDone ? 'bg-pink-200' : 'bg-slate-100'}`} />
        )}
      </div>
      <div className="pb-5 min-w-0">
        <p className={`text-sm font-semibold truncate ${
          isDone ? 'text-slate-800' : isActive ? 'text-fuchsia-700' : 'text-slate-400'
        }`}>{step.label}</p>
        <p className={`text-xs mt-0.5 leading-relaxed line-clamp-2 ${
          isDone ? 'text-slate-500' : isActive ? 'text-fuchsia-500' : 'text-slate-300'
        }`}>{detail || step.desc}</p>
      </div>
    </div>
  );
}

export default function IGWorkflow({
  loading, result, currentIteration, reflexionHistory,
  searchData, partialCritiques, getStepStatus, getStepDetail, hashtags,
}) {
  const critiques = result?.critiques || partialCritiques;

  return (
    <div className="lg:col-span-4 space-y-4">

      {/* Pipeline steps */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-pink-50/80 to-fuchsia-50/60">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
            <BrainCircuit className="w-4 h-4 text-pink-500" /> Instagram Agent Pipeline
          </h2>
          {loading && (
            <span className="inline-flex items-center gap-1.5 text-xs bg-pink-100 text-pink-700 px-2.5 py-1 rounded-md font-semibold mt-2">
              <RefreshCw className={`w-3 h-3 ${currentIteration > 1 ? 'animate-spin' : ''}`} />
              Iteration {currentIteration}{currentIteration > 1 ? ' (Reflexion)' : ''}
            </span>
          )}
        </div>
        <div className="p-5">
          {IG_PIPELINE_STEPS.map((step, i) => (
            <PipelineStep
              key={step.id} step={step}
              status={getStepStatus(i)} detail={getStepDetail(i)}
              isLast={i === IG_PIPELINE_STEPS.length - 1}
            />
          ))}
        </div>

        {reflexionHistory.length > 0 && (
          <div className="px-5 pb-4 space-y-2">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reflexion Log</p>
            {reflexionHistory.map((r, i) => (
              <div key={i} className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${r.manual ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                <RefreshCw className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${r.manual ? 'text-blue-500' : 'text-amber-500'}`} />
                <div>
                  <p className={`text-xs font-semibold ${r.manual ? 'text-blue-700' : 'text-amber-700'}`}>
                    Iter {r.iteration}: {r.manual ? 'User refinement' : `Score ${(r.previous_score * 100).toFixed(1)}% below threshold`}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${r.manual ? 'text-blue-500' : 'text-amber-500'}`}>{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hashtag tiers */}
      {hashtags?.all?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
          <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-fuchsia-500" /> Hashtags
            <span className="text-[10px] bg-fuchsia-100 text-fuchsia-600 px-2 py-0.5 rounded-full font-bold ml-auto">{hashtags.total}</span>
          </h3>
          {['mega', 'mid', 'niche', 'location'].map(tier => (
            hashtags[tier]?.length > 0 && (
              <div key={tier} className="mb-3">
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-1.5">{tier}</p>
                <div className="flex flex-wrap gap-1">
                  {hashtags[tier].map((tag, i) => (
                    <span key={i} className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      tier === 'mega'     ? 'bg-pink-50 text-pink-600' :
                      tier === 'mid'      ? 'bg-fuchsia-50 text-fuchsia-600' :
                      tier === 'niche'    ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>{tag}</span>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Search results */}
      {searchData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan-500" /> Trend Research
              <span className="ml-auto text-[10px] text-slate-400">{searchData.results?.length || 0} sources</span>
            </h3>
          </div>
          <div className="p-4">
            {searchData.insights && (
              <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-100 mb-3">
                <p className="text-[10px] uppercase font-bold text-cyan-600 mb-1">Key Trends</p>
                <p className="text-xs text-slate-700 leading-relaxed">{searchData.insights}</p>
              </div>
            )}
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(searchData.results || []).slice(0, 6).map((r, i) => (
                <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                  className="block bg-slate-50 hover:bg-pink-50 rounded-lg p-2 border border-slate-100 hover:border-pink-200 transition group">
                  <p className="text-xs font-medium text-slate-700 group-hover:text-pink-700 line-clamp-1">{r.title}</p>
                  <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{r.snippet}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Critiques */}
      {critiques && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" /> Agent Reviews
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            {critiques.map((c, i) => {
              const config = [
                { bg: 'bg-pink-50',   border: 'border-pink-100',   icon: Activity,      color: 'text-pink-500',   label: 'Virality' },
                { bg: 'bg-purple-50', border: 'border-purple-100', icon: Shield,         color: 'text-purple-500', label: 'Brand' },
                { bg: 'bg-amber-50',  border: 'border-amber-100',  icon: AlertTriangle,  color: 'text-amber-500',  label: 'Ethics' },
              ][i] || {};
              const Icon = config.icon;
              return (
                <div key={i} className={`${config.bg} rounded-xl p-3 border ${config.border}`}>
                  <p className={`text-[10px] font-bold uppercase ${config.color} mb-1.5`}>{config.label}</p>
                  <div className="flex items-start gap-2">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <p className="text-xs text-slate-700 leading-relaxed">{c}</p>
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
import React from 'react';
import { Loader2, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { IG_FORMAT_COLORS, IG_TONE_COLORS } from '../constants/ig_pipeline';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function IGCopilot({ data, loading, error, onRefresh, onRetry }) {
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      <span className="ml-3 text-sm text-slate-500 font-medium">Analyzing Instagram patterns…</span>
    </div>
  );

  if (error && !data) return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
      <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="text-sm font-semibold text-red-700 mb-4">{error}</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-2 text-xs bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg font-semibold transition">
        <RefreshCw className="w-3 h-3" /> Retry
      </button>
    </div>
  );

  if (!data) return null;

  return (
    <>
      {/* Strategy hero */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 text-white p-8 rounded-2xl shadow-lg shadow-pink-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> Instagram Growth Strategy
            </h2>
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg font-semibold transition backdrop-blur">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
            <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{data.strategy}</p>
          </div>
          <div className="flex items-center gap-6 mt-5 text-sm">
            <div className="text-center">
              <p className="text-xl font-black">{data.avg_engagement?.toFixed(1)}%</p>
              <p className="text-white/70 text-xs">Avg Engagement</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black">{data.best_format}</p>
              <p className="text-white/70 text-xs">Best Format</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black">{data.best_tone}</p>
              <p className="text-white/70 text-xs">Best Tone</p>
            </div>
          </div>
        </div>
      </div>

      {/* 14-day history */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-sm text-slate-800">14-Day Engagement History</h3>
          <p className="text-xs text-slate-400 mt-0.5">Format + Tone vs. Engagement Rate</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {(data.recent_trend || []).map((day, i) => {
              const rate  = parseFloat(day.engagement_rate);
              const isLow = rate < 3; const isHigh = rate > 6;
              return (
                <div key={i} className={`border rounded-xl p-3 text-center hover:-translate-y-0.5 hover:shadow-md transition-all ${
                  isLow ? 'bg-red-50/60 border-red-200/60' : 'bg-slate-50 border-slate-200/60'
                }`}>
                  <p className="text-[10px] text-slate-400 font-medium mb-1">{String(day.date).slice(5)}</p>
                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mb-1 ${IG_FORMAT_COLORS[day.format] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {day.format}
                  </span><br />
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border ${IG_TONE_COLORS[day.tone] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {day.tone}
                  </span>
                  <div className="flex items-center justify-center gap-0.5 mt-1.5">
                    {isHigh && <TrendingUp className="w-3 h-3 text-emerald-500" />}
                    {isLow  && <TrendingDown className="w-3 h-3 text-red-400" />}
                    <p className={`text-base font-black ${isHigh ? 'text-emerald-600' : isLow ? 'text-red-500' : 'text-slate-700'}`}>
                      {rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ML 7-day predictions */}
      {data.ml_predictions?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-800">LightGBM 7-Day Content Plan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Optimal format + tone per day</p>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {data.ml_predictions.map((day, i) => (
                <div key={i} className="border border-pink-200/50 bg-gradient-to-b from-pink-50/40 to-white rounded-xl p-3 text-center hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <p className="text-[10px] text-slate-400 font-medium mb-0.5">Day +{day.day_offset}</p>
                  <p className="text-xs font-black text-slate-700 mb-2">{DAYS[day.day_of_week]}</p>
                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mb-1 ${IG_FORMAT_COLORS[day.recommended_format] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {day.recommended_format}
                  </span><br />
                  <span className={`inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded border ${IG_TONE_COLORS[day.recommended_tone] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {day.recommended_tone}
                  </span>
                  <div className="flex items-center justify-center gap-0.5 mt-1.5">
                    <TrendingUp className="w-3 h-3 text-pink-500" />
                    <p className="text-base font-black text-pink-600">{day.predicted_engagement?.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
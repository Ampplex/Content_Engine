import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  LineChart, Loader2, AlertTriangle, RefreshCw,
  BarChart3, TrendingDown, TrendingUp
} from 'lucide-react';
import { TONE_COLORS } from '../constants/pipeline';

/**
 * Growth Copilot tab: AI strategy card, 14-day engagement timeline,
 * and LightGBM 7-day prediction plan.
 */
export default function GrowthCopilot({ data, loading, error, onRefresh, onRetry }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="ml-3 text-sm text-slate-500 font-medium">Analyzing engagement patterns...</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-red-700 mb-1">Copilot Error</p>
        <p className="text-xs text-red-500 mb-3">{error}</p>
        <button
          onClick={onRetry}
          className="text-xs bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg font-medium transition flex items-center gap-1.5 mx-auto"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      {/* ── Strategy Card ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white p-8 rounded-2xl shadow-lg shadow-indigo-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
            <LineChart className="w-5 h-5" />
            AI Strategic Recommendation
          </h2>
          <div className="bg-white/10 backdrop-blur-sm p-5 rounded-xl border border-white/20
            prose prose-sm prose-invert max-w-none
            prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
            prose-headings:text-white prose-headings:mt-3 prose-headings:mb-1
            prose-strong:text-white prose-a:text-indigo-200 hover:prose-a:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.strategy}</ReactMarkdown>
          </div>
        </div>
      </div>

      {/* ── 14-Day Engagement Timeline ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm text-slate-800">14-Day Engagement Timeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tone distribution vs engagement performance</p>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {(data.recent_trend || []).map((day, i) => {
              const rate = parseFloat(day.engagement_rate);
              const isLow = rate < 3;
              const isHigh = rate > 5;
              return (
                <div
                  key={i}
                  className={`border rounded-xl p-3 text-center transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    isLow ? 'bg-red-50/50 border-red-200/60' : 'bg-slate-50/50 border-slate-200/60'
                  }`}
                >
                  <p className="text-[11px] text-slate-400 font-medium mb-1.5">
                    {String(day.date).slice(5)}
                  </p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {day.tone}
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {isLow ? <TrendingDown className="w-3 h-3 text-red-500" /> :
                     isHigh ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : null}
                    <p className={`text-lg font-bold ${isLow ? 'text-red-500' : isHigh ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {rate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── LightGBM 7-Day Prediction Plan ─────────────────────────────── */}
      {data.ml_predictions?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-800">LightGBM 7-Day Prediction Plan</h3>
                <p className="text-xs text-slate-400 mt-0.5">ML-optimized tone recommendations per day</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
              {data.ml_predictions.map((day, i) => {
                const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const rate = day.predicted_engagement;
                return (
                  <div
                    key={i}
                    className="border rounded-xl p-3 text-center bg-gradient-to-b from-blue-50/40 to-white border-blue-200/50 transition-all hover:shadow-md hover:-translate-y-0.5"
                  >
                    <p className="text-[11px] text-slate-400 font-medium mb-0.5">Day +{day.day_offset}</p>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">{DAYS[day.day_of_week]}</p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.recommended_tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {day.recommended_tone}
                    </span>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3 text-blue-500" />
                      <p className="text-lg font-bold text-blue-600">{rate.toFixed(1)}%</p>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">predicted</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[11px] text-slate-500">
                Predictions from LightGBM model trained on engagement patterns (tone, day-of-week, frequency, momentum)
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

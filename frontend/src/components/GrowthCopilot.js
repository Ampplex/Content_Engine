import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LineChart, Loader2, AlertTriangle, RefreshCw, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { TONE_COLORS } from '../constants/pipeline';

export default function GrowthCopilot({ data, loading, error, onRefresh, onRetry, theme = 'dark' }) {
  const isDark = theme === 'dark';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className={`w-8 h-8 animate-spin ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`} />
        <span className={`ml-3 text-sm font-medium ${isDark ? 'text-indigo-100/70' : 'text-slate-600'}`}>
          Analyzing engagement patterns...
        </span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`${isDark ? 'bg-red-500/10 border-red-300/40' : 'bg-red-50 border-red-200'} border rounded-2xl p-6 text-center`}>
        <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-red-300' : 'text-red-500'}`} />
        <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-red-200' : 'text-red-700'}`}>Copilot Error</p>
        <p className={`text-xs mb-3 ${isDark ? 'text-red-100/85' : 'text-red-600'}`}>{error}</p>
        <button
          onClick={onRetry}
          className={`text-xs px-4 py-2 rounded-lg font-medium transition flex items-center gap-1.5 mx-auto border ${
            isDark
              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-300/35'
              : 'bg-red-100 hover:bg-red-200 text-red-700 border-red-200'
          }`}
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <>
      <div
        className={`p-8 rounded-2xl border relative overflow-hidden ${
          isDark
            ? 'bg-gradient-to-r from-indigo-500/40 via-purple-500/40 to-indigo-500/40 text-white border-indigo-300/25'
            : 'bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100 text-slate-900 border-indigo-200'
        }`}
      >
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <LineChart className="w-5 h-5" /> AI Strategic Recommendation
        </h2>
        <div
          className={`p-5 rounded-xl border prose prose-sm max-w-none ${
            isDark
              ? 'bg-slate-950/35 border-indigo-200/25 prose-invert text-indigo-100/90'
              : 'bg-white/70 border-indigo-200 text-slate-700'
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.strategy}</ReactMarkdown>
        </div>
      </div>

      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/60 border-indigo-300/25' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'border-indigo-300/20' : 'border-slate-200'}`}>
          <div>
            <h3 className={`font-semibold text-sm ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>14-Day Engagement Timeline</h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>Tone distribution vs engagement performance</p>
          </div>
          <button
            onClick={onRefresh}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 border ${
              isDark
                ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 border-indigo-300/35'
                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
            }`}
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
                <div key={i} className={`border rounded-xl p-3 text-center ${isDark ? 'bg-slate-950/40 border-indigo-300/20' : 'bg-slate-50 border-slate-200'}`}>
                  <p className={`text-[11px] font-medium mb-1.5 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>{String(day.date).slice(5)}</p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {day.tone}
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {isLow ? <TrendingDown className="w-3 h-3 text-red-400" /> : isHigh ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : null}
                    <p className={`text-lg font-bold ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>{rate.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {data.ml_predictions?.length > 0 && (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/60 border-indigo-300/25' : 'bg-white border-slate-200'}`}>
          <div className={`px-6 py-4 border-b ${isDark ? 'border-indigo-300/20' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className={`font-semibold text-sm ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>LightGBM 7-Day Prediction Plan</h3>
                <p className={`text-xs mt-0.5 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>ML-optimized tone recommendations per day</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
              {data.ml_predictions.map((day, i) => (
                <div key={i} className={`border rounded-xl p-3 text-center ${isDark ? 'bg-gradient-to-b from-blue-500/10 to-slate-950/30 border-blue-300/25' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-[11px] font-medium mb-0.5 ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>Day +{day.day_offset}</p>
                  <p className={`text-xs font-bold mb-1.5 ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>{DAYS[day.day_of_week]}</p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.recommended_tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {day.recommended_tone}
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-400" />
                    <p className={`text-lg font-bold ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>{day.predicted_engagement?.toFixed(1)}%</p>
                  </div>
                  <p className={`text-[9px] mt-0.5 ${isDark ? 'text-indigo-100/55' : 'text-slate-600'}`}>predicted</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

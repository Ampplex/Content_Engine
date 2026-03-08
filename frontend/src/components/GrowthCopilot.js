import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LineChart, Loader2, AlertTriangle, RefreshCw, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import { TONE_COLORS } from '../constants/pipeline';

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
      <div className="ui-alert-error text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-red-700 mb-1">Copilot Error</p>
        <p className="text-xs text-red-500 mb-3">{error}</p>
        <button onClick={onRetry} className="ui-btn-secondary mx-auto">
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div className="ui-card p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900">
            <LineChart className="w-5 h-5 text-indigo-600" />
            AI Strategic Recommendation
          </h2>
          <button onClick={onRefresh} className="ui-btn-secondary">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1 prose-a:text-indigo-600 hover:prose-a:underline">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.strategy}</ReactMarkdown>
        </div>
      </div>

      <div className="ui-card overflow-hidden">
        <div className="ui-card-header flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm text-slate-800">14-Day Engagement Timeline</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tone distribution vs engagement performance</p>
          </div>
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
                  className={`border rounded-xl p-3 text-center transition-colors hover:shadow-md ${
                    isLow ? 'bg-red-50/50 border-red-200/60' : 'bg-slate-50/50 border-slate-200/60'
                  }`}
                >
                  <p className="text-[11px] text-slate-400 font-medium mb-1.5">{String(day.date).slice(5)}</p>
                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {day.tone}
                  </span>
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {isLow ? <TrendingDown className="w-3 h-3 text-red-500" /> : isHigh ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : null}
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

      {data.ml_predictions?.length > 0 && (
        <div className="ui-card overflow-hidden">
          <div className="ui-card-header">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-800">LightGBM 7-Day Prediction Plan</h3>
                <p className="text-xs text-slate-400 mt-0.5">ML optimized tone recommendations per day</p>
              </div>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
              {data.ml_predictions.map((day, i) => {
                const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const rate = day.predicted_engagement;
                return (
                  <div key={i} className="border rounded-xl p-3 text-center bg-blue-50/40 border-blue-200/50 transition-colors hover:shadow-md">
                    <p className="text-[11px] text-slate-400 font-medium mb-0.5">Day +{day.day_offset}</p>
                    <p className="text-xs font-bold text-slate-700 mb-1.5">{DAYS[day.day_of_week]}</p>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[day.recommended_tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {day.recommended_tone}
                    </span>
                    <div className="mt-2 flex items-center justify-center gap-1">
                      <TrendingUp className="w-3 h-3 text-blue-500" />
                      <p className="text-lg font-bold text-blue-600">{rate.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-2 px-1">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <p className="text-[11px] text-slate-500">
                Predictions are generated from tone, day-of-week, posting frequency, and momentum features.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

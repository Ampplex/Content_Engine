import React, { useState } from 'react';
import {
  Crosshair, Search, Loader2, Lightbulb, Target, TrendingUp,
  Film, Layers, Hash, ExternalLink, Sparkles, AlertCircle,
} from 'lucide-react';
import { IG_API_BASE } from '../constants/ig_pipeline';

function InsightCard({ title, icon: Icon, accentClass, items, numbered, badge }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2 mb-4">
        <Icon className={`w-4 h-4 ${accentClass.icon}`} />
        {title}
        {badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ml-auto ${accentClass.badge}`}>{badge}</span>
        )}
      </h3>
      {!items?.length
        ? <p className="text-xs text-slate-300 italic">No data</p>
        : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className={`rounded-xl px-3.5 py-2.5 border flex items-start gap-2.5 ${accentClass.row}`}>
                {numbered
                  ? <span className={`text-[11px] font-black mt-0.5 w-4 flex-shrink-0 ${accentClass.icon}`}>{i + 1}.</span>
                  : <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${accentClass.dot}`} />
                }
                <p className="text-xs text-slate-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

const ACCENTS = {
  amber:   { icon: 'text-amber-500',   dot: 'bg-amber-400',   row: 'bg-amber-50 border-amber-200/60',   badge: 'bg-amber-100 text-amber-700 border-amber-200' },
  pink:    { icon: 'text-pink-500',    dot: 'bg-pink-400',    row: 'bg-pink-50 border-pink-200/60',     badge: 'bg-pink-100 text-pink-700 border-pink-200' },
  purple:  { icon: 'text-purple-500',  dot: 'bg-purple-400',  row: 'bg-purple-50 border-purple-200/60', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
  rose:    { icon: 'text-rose-500',    dot: 'bg-rose-400',    row: 'bg-rose-50 border-rose-200/60',     badge: 'bg-rose-100 text-rose-700 border-rose-200' },
  blue:    { icon: 'text-blue-500',    dot: 'bg-blue-400',    row: 'bg-blue-50 border-blue-200/60',     badge: 'bg-blue-100 text-blue-700 border-blue-200' },
  emerald: { icon: 'text-emerald-500', dot: 'bg-emerald-400', row: 'bg-emerald-50 border-emerald-200/60', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export default function IGCompetitor() {
  const [topic,    setTopic]    = useState('');
  const [enrich,   setEnrich]   = useState(true);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [data,     setData]     = useState(null);
  const [hashCopy, setHashCopy] = useState(false);

  const analyze = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res  = await fetch(`${IG_API_BASE}/api/ig/competitor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), enrich_hashtags: enrich }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch { setError('Instagram API unreachable. Start backend/main.py on :8000 and retry.'); }
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-white text-slate-900 rounded-2xl p-7 border border-slate-200 shadow-sm">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black">Instagram Niche Intelligence</h2>
            <p className="text-slate-500 text-sm mt-0.5">Discover what is working in your niche</p>
          </div>
        </div>
      </div>

      {/* Search input */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex-grow min-w-[200px]">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Niche / Topic</label>
          <input
            value={topic} onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
            placeholder="e.g. fitness for Indian college students, personal finance Gen Z India..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium bg-slate-50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30 focus:border-fuchsia-400 transition"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500 font-semibold cursor-pointer mb-0.5 whitespace-nowrap">
          <input type="checkbox" checked={enrich} onChange={e => setEnrich(e.target.checked)} className="w-4 h-4 accent-fuchsia-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2" />
          Enrich hashtags
        </label>
        <button
          onClick={analyze} disabled={loading || !topic.trim()}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 focus-visible:ring-offset-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Analyzing...' : 'Analyze Niche'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-2/5" />
              {[1, 2, 3].map(j => <div key={j} className="h-3 bg-slate-100 rounded" />)}
            </div>
          ))}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Recommendation */}
          {data.recommended_approach && (
            <div className="bg-gradient-to-r from-fuchsia-50 to-pink-50 border border-fuchsia-200/60 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-fuchsia-600" />
                <h3 className="font-bold text-fuchsia-800 text-sm">Instagram Strategy Recommendation</h3>
              </div>
              <p className="text-sm text-fuchsia-900 leading-relaxed">{data.recommended_approach}</p>
            </div>
          )}

          {/* Insight cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard title="Scroll-Stopping Hooks"      icon={Lightbulb}   accentClass={ACCENTS.amber}   items={data.top_hooks || []}        numbered />
            <InsightCard title="Winning Formats"            icon={Film}        accentClass={ACCENTS.pink}    items={data.winning_formats || []} />
            <InsightCard title="Content Gaps (Own It)"      icon={Target}      accentClass={ACCENTS.purple}  items={data.content_gaps || []}    badge="Opportunity" />
            <InsightCard title="Reel Ideas"                 icon={Film}        accentClass={ACCENTS.rose}    items={data.reel_ideas || []}      badge="30s" />
            <InsightCard title="Carousel Ideas"             icon={Layers}      accentClass={ACCENTS.blue}    items={data.carousel_ideas || []} />
            <InsightCard title="Winning Tones"              icon={TrendingUp}  accentClass={ACCENTS.emerald} items={data.winning_tones || []} />
          </div>

          {/* Hashtags */}
          {data.popular_hashtags?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-fuchsia-500" />
                  Hashtag Intelligence
                  <span className="text-[10px] bg-fuchsia-100 text-fuchsia-600 px-2 py-0.5 rounded-full font-bold">{data.popular_hashtags.length}</span>
                </h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.popular_hashtags.join(' '));
                    setHashCopy(true); setTimeout(() => setHashCopy(false), 2000);
                  }}
                  className="text-xs text-fuchsia-600 border border-fuchsia-200 px-3 py-1 rounded-lg hover:bg-fuchsia-50 font-semibold transition"
                >
                  {hashCopy ? 'Copied!' : 'Copy All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.popular_hashtags.map((tag, i) => (
                  <span key={i} className="text-xs bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-fuchsia-100 transition cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {data.raw_sources?.filter(Boolean).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-slate-400" /> Sources
              </h3>
              <div className="space-y-1.5">
                {data.raw_sources.filter(Boolean).slice(0, 5).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-slate-500 hover:text-fuchsia-600 truncate hover:underline">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-16 text-center">
          <Crosshair className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Enter a niche to analyze Instagram content landscape</p>
        </div>
      )}
    </div>
  );
}

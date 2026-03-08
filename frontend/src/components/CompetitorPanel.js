import React, { useState } from 'react';
import { Search, Loader2, Hash, Lightbulb, Target, TrendingUp,
         Crosshair, ExternalLink, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { API_BASE } from '../constants/pipeline';

/**
 * Competitor Analysis Panel
 * POST /api/competitor → structured insights: hooks, angles, gaps, hashtags
 */
export default function CompetitorPanel() {
  const [topic, setTopic]       = useState('');
  const [enrich, setEnrich]     = useState(true);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [data, setData]         = useState(null);
  const [copied, setCopied]     = useState('');

  const analyze = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res  = await fetch(`${API_BASE}/api/competitor`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ topic: topic.trim(), enrich_hashtags: enrich }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setData(json);
    } catch (e) {
      setError('Backend unreachable. Is the server running on port 8000?');
    }
    setLoading(false);
  };

  const copyAll = (list) => {
    navigator.clipboard.writeText(list.join('\n'));
    setCopied('hooks'); setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-2xl p-7 relative overflow-hidden shadow-lg shadow-teal-200/40">
        <div className="absolute right-0 top-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Crosshair className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold">Competitor Intelligence</h2>
          </div>
          <p className="text-teal-100 text-sm mt-1">
            Analyze top-performing LinkedIn content in any niche. Extract hooks, angles, gaps & hashtags.
          </p>
        </div>
      </div>

      {/* ── Input Card ─────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex gap-3 items-end">
          <div className="flex-grow">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">Niche / Topic</label>
            <input
              value={topic}
              onChange={e => setTopic(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && analyze()}
              placeholder="e.g. AI in Indian hiring, SaaS growth strategies, Web3 for SMEs..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition"
            />
          </div>
          <div className="flex items-center gap-2 mb-0.5 whitespace-nowrap">
            <input type="checkbox" id="enrich" checked={enrich} onChange={e => setEnrich(e.target.checked)}
              className="accent-teal-600 w-4 h-4" />
            <label htmlFor="enrich" className="text-xs text-slate-500 font-medium">Enrich hashtags</label>
          </div>
          <button
            onClick={analyze}
            disabled={loading || !topic.trim()}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition shadow-md shadow-teal-200/40 disabled:shadow-none whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Analyzing...' : 'Analyze Niche'}
          </button>
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ── Loading skeleton ────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3 mb-4" />
              {[1,2,3].map(j => <div key={j} className="h-3 bg-slate-100 rounded mb-2" />)}
            </div>
          ))}
        </div>
      )}

      {/* ═══ RESULTS ═══════════════════════════════════════════════════ */}
      {data && !loading && (
        <>
          {/* Recommended Approach */}
          {data.recommended_approach && (
            <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/60 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <h3 className="font-bold text-teal-800 text-sm">Strategic Recommendation</h3>
              </div>
              <p className="text-sm text-teal-900 leading-relaxed">{data.recommended_approach}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Top Hooks */}
            <InsightCard
              title="Top-Performing Hooks"
              icon={<Lightbulb className="w-4 h-4 text-amber-500" />}
              accent="amber"
              items={data.top_hooks || []}
              onCopyAll={() => { navigator.clipboard.writeText((data.top_hooks||[]).join('\n\n')); setCopied('hooks'); setTimeout(()=>setCopied(''),1500); }}
              copied={copied === 'hooks'}
              numbered
            />

            {/* Winning Angles */}
            <InsightCard
              title="Winning Angles"
              icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
              accent="emerald"
              items={data.winning_angles || []}
            />

            {/* Content Gaps */}
            <InsightCard
              title="Content Gaps (Underexplored)"
              icon={<Target className="w-4 h-4 text-purple-500" />}
              accent="purple"
              items={data.content_gaps || []}
              badge="Opportunity"
            />

            {/* Structural Patterns */}
            <InsightCard
              title="Structural Patterns"
              icon={<ChevronRight className="w-4 h-4 text-blue-500" />}
              accent="blue"
              items={data.structural_patterns || []}
            />
          </div>

          {/* Hashtags */}
          {(data.popular_hashtags || []).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-indigo-500" /> Hashtag Intelligence
                  <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-bold ml-1">
                    {data.popular_hashtags.length} tags
                  </span>
                </h3>
                <button
                  onClick={() => { navigator.clipboard.writeText(data.popular_hashtags.join(' ')); setCopied('tags'); setTimeout(()=>setCopied(''),1500); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition"
                >
                  {copied === 'tags' ? '✓ Copied' : 'Copy all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.popular_hashtags.map((tag, i) => (
                  <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 transition cursor-default">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {(data.raw_sources || []).filter(Boolean).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-sm text-slate-800 mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-slate-400" /> Sources Used
              </h3>
              <div className="space-y-2">
                {data.raw_sources.filter(Boolean).slice(0, 6).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-slate-500 hover:text-teal-600 truncate hover:underline">
                    {url}
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-14 text-center">
          <Crosshair className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Enter a niche above to analyze the competitive landscape</p>
          <p className="text-xs text-slate-300 mt-1">Pulls top posts via web search, extracts patterns with LLM</p>
        </div>
      )}
    </div>
  );
}

// ── Reusable insight card ──────────────────────────────────────────────────────
function InsightCard({ title, icon, accent, items, numbered, onCopyAll, copied, badge }) {
  const accentMap = {
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200/60', dot: 'bg-amber-400',   text: 'text-amber-700' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200/60', dot: 'bg-emerald-400', text: 'text-emerald-700' },
    purple:  { bg: 'bg-purple-50',  border: 'border-purple-200/60', dot: 'bg-purple-400',  text: 'text-purple-700' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200/60',   dot: 'bg-blue-400',    text: 'text-blue-700'   },
  };
  const c = accentMap[accent] || accentMap.blue;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
          {icon}{title}
          {badge && <span className={`text-[10px] ${c.text} ${c.bg} border ${c.border} px-2 py-0.5 rounded-full font-bold`}>{badge}</span>}
        </h3>
        {onCopyAll && (
          <button onClick={onCopyAll}
            className="text-[11px] text-slate-400 hover:text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 transition">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
      {items.length === 0
        ? <p className="text-xs text-slate-300 italic">No data available</p>
        : (
          <div className="space-y-2.5">
            {items.map((item, i) => (
              <div key={i} className={`${c.bg} border ${c.border} rounded-xl px-3.5 py-2.5 flex items-start gap-2.5`}>
                {numbered
                  ? <span className={`text-[11px] font-black ${c.text} mt-0.5 w-4 flex-shrink-0`}>{i + 1}.</span>
                  : <div className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 flex-shrink-0`} />
                }
                <p className="text-xs text-slate-700 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}
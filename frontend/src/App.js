import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Zap, AlertTriangle } from 'lucide-react';

import { LANGUAGES, API_BASE } from './constants/pipeline';
import { IG_API_BASE, IG_LANGUAGES, IG_FORMAT_COLORS, IG_TONE_COLORS } from './constants/ig_pipeline';
import { usePipeline }   from './hooks/usePipeline';
import { useIGPipeline } from './hooks/useIGPipeline';

import Header        from './components/Header';
import AgentWorkflow from './components/AgentWorkflow';
import ScoringPanel  from './components/ScoringPanel';
import FinalPostPanel from './components/FinalPostPanel';
import GrowthCopilot  from './components/GrowthCopilot';
import IGWorkflow     from './components/IGWorkflow';
import IGScoringPanel from './components/IGScoringPanel';
import IGOutputPanel  from './components/IGOutputPanel';
import IGCopilot      from './components/IGCopilot';
import IGScheduler    from './components/IGScheduler';
import IGCompetitor   from './components/IGCompetitor';

export default function App() {
  const [platform, setPlatform] = useState('linkedin');   // 'linkedin' | 'instagram'
  const [tab,      setTab]      = useState('generator');
  const [topic,    setTopic]    = useState('');
  const [language, setLanguage] = useState('English');

  // When platform changes, reset to generator tab with correct default
  const handlePlatformChange = (p) => {
    setPlatform(p);
    setTab(p === 'instagram' ? 'ig_generator' : 'generator');
    setTopic('');
  };

  // ── LinkedIn pipeline ────────────────────────────────────────────────────
  const li = usePipeline();
  const setLiError = li.setError;

  const toUnicodeBold = (text) =>
    [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90)  return String.fromCodePoint(0x1D5D4 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D5EE + c - 97);
      if (c >= 48 && c <= 57)  return String.fromCodePoint(0x1D7EC + c - 48);
      return ch;
    }).join('');

  const toUnicodeItalic = (text) =>
    [...text].map(ch => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90)  return String.fromCodePoint(0x1D608 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D622 + c - 97);
      return ch;
    }).join('');

  const toLinkedInText = (md) =>
    md
      .replace(/^#{1,6}\s+(.+)/gm, (_, t) => toUnicodeBold(t))
      .replace(/\*\*(.+?)\*\*/g, (_, t) => toUnicodeBold(t))
      .replace(/__(.+?)__/g,     (_, t) => toUnicodeBold(t))
      .replace(/\*(.+?)\*/g,     (_, t) => toUnicodeItalic(t))
      .replace(/_(.+?)_/g,       (_, t) => toUnicodeItalic(t))
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '• ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const handleLICopy = () => {
    let body = li.result?.final_post || '';
    if (li.result?.hook) body = body.replace(li.result.hook, '').replace(`**${li.result.hook}**`, '').replace(/^\s*\n/, '');
    const text = li.result?.hook ? toUnicodeBold(li.result.hook) + '\n\n' + body : body;
    navigator.clipboard.writeText(toLinkedInText(text));
  };

  // ── Instagram pipeline ───────────────────────────────────────────────────
  const ig = useIGPipeline();
  const setIgError = ig.setError;

  const handleIGCopy = () => {
    if (!ig.result) return;
    const full = [
      ig.result.hook    ? ig.result.hook + '\n\n' : '',
      ig.result.caption || '',
      ig.result.hashtags?.caption_block || '',
    ].join('');
    navigator.clipboard.writeText(full);
  };

  // ── Copilot (LinkedIn) ───────────────────────────────────────────────────
  const [copilotData,    setCopilotData]    = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const fetchLICopilot = useCallback(async () => {
    setCopilotLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/api/copilot`);
      const data = await res.json();
      if (!res.ok || data.error) setLiError(data.error || 'Copilot failed');
      else { setCopilotData(data); setLiError(null); }
    } catch { setLiError('Failed to connect to LinkedIn backend.'); }
    setCopilotLoading(false);
  }, [setLiError]);

  // ── Copilot (Instagram) ──────────────────────────────────────────────────
  const [igCopilotData,    setIGCopilotData]    = useState(null);
  const [igCopilotLoading, setIGCopilotLoading] = useState(false);

  const fetchIGCopilot = useCallback(async () => {
    setIGCopilotLoading(true);
    try {
      const res  = await fetch(`${IG_API_BASE}/api/ig/copilot`);
      const data = await res.json();
      if (data.error) setIgError(data.error);
      else { setIGCopilotData(data); setIgError(null); }
    } catch { setIgError('Failed to connect to Instagram API.'); }
    setIGCopilotLoading(false);
  }, [setIgError]);

  useEffect(() => {
    if (tab === 'copilot'    && !copilotData)   fetchLICopilot();
    if (tab === 'ig_copilot' && !igCopilotData) fetchIGCopilot();
  }, [tab, copilotData, igCopilotData, fetchLICopilot, fetchIGCopilot]);

  const isIG = platform === 'instagram';
  const bgClass = isIG ? 'bg-rose-50/30' : 'bg-slate-50';

  return (
    <div className={`min-h-screen ${bgClass} text-slate-900 font-sans transition-colors duration-500`}>
      <Header
        tab={tab} onTabChange={setTab}
        platform={platform} onPlatformChange={handlePlatformChange}
      />

      <main className="max-w-[1600px] mx-auto px-6 py-6">

        {/* ════════════════════════════════════════════════════════════════
            LINKEDIN TABS
        ════════════════════════════════════════════════════════════════ */}

        {/* LI: Content Generator */}
        {tab === 'generator' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex gap-3 items-center">
              <input
                className="flex-grow border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Why India's SaaS founders are betting big on AI agents"
                onKeyDown={e => e.key === 'Enter' && !li.loading && li.handleGenerate(topic, language)}
              />
              <select
                value={language} onChange={e => setLanguage(e.target.value)}
                className="border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium focus:outline-none min-w-[120px]"
              >
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={() => li.handleGenerate(topic, language)}
                disabled={li.loading || !topic.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
              >
                {li.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Orchestrating…</> : <><Zap className="w-4 h-4" /> Orchestrate</>}
              </button>
            </div>

            {li.error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{li.error}</p>
                </div>
              </div>
            )}

            {(li.loading || li.result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <AgentWorkflow
                  loading={li.loading} result={li.result}
                  currentIteration={li.currentIteration} reflexionHistory={li.reflexionHistory}
                  searchData={li.searchData} partialCritiques={li.partialCritiques}
                  getStepStatus={li.getStepStatus} getStepDetail={li.getStepDetail}
                  language={language}
                />
                <ScoringPanel result={li.result} partialScores={li.partialScores} />
                <FinalPostPanel
                  result={li.result} loading={li.loading} language={language}
                  onRefine={() => li.handleRefine(topic, language)} onCopy={handleLICopy}
                />
              </div>
            )}

            {!li.loading && !li.result && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
                  <Zap className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Multi-Agent LinkedIn Content</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Enter a topic. The 9-agent LangGraph pipeline drafts, localizes, critiques, scores,
                  and optimizes your LinkedIn post — powered by AWS Bedrock.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LI: Growth Copilot */}
        {tab === 'copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <GrowthCopilot
              data={copilotData} loading={copilotLoading} error={li.error}
              onRefresh={() => { setCopilotData(null); fetchLICopilot(); }}
              onRetry={() => { li.setError(null); fetchLICopilot(); }}
            />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            INSTAGRAM TABS
        ════════════════════════════════════════════════════════════════ */}

        {/* IG: Content Generator */}
        {tab === 'ig_generator' && (
          <div className="space-y-6">
            {/* Input bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-pink-100/80 flex gap-3 items-center">
              <input
                className="flex-grow border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400/30 focus:border-pink-400 transition"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g. 5 money habits every Indian 20-something needs to build"
                onKeyDown={e => e.key === 'Enter' && !ig.loading && ig.handleGenerate(topic, language)}
              />
              <select
                value={language} onChange={e => setLanguage(e.target.value)}
                className="border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium focus:outline-none min-w-[120px]"
              >
                {IG_LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={() => ig.handleGenerate(topic, language)}
                disabled={ig.loading || !topic.trim()}
                className="bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition"
              >
                {ig.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Zap className="w-4 h-4" /> Create Content</>}
              </button>
            </div>

            {/* Format badge */}
            {(ig.selectedFormat || ig.selectedTone) && (
              <div className="flex items-center gap-2">
                {ig.selectedFormat && (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${IG_FORMAT_COLORS[ig.selectedFormat] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {ig.selectedFormat}
                  </span>
                )}
                {ig.selectedTone && (
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${IG_TONE_COLORS[ig.selectedTone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {ig.selectedTone}
                  </span>
                )}
                <span className="text-xs text-slate-400">AI selected format</span>
              </div>
            )}

            {ig.error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{ig.error}</p>
                </div>
              </div>
            )}

            {(ig.loading || ig.result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <IGWorkflow
                  loading={ig.loading} result={ig.result}
                  currentIteration={ig.currentIteration} reflexionHistory={ig.reflexionHistory}
                  searchData={ig.searchData} partialCritiques={ig.partialCritiques}
                  getStepStatus={ig.getStepStatus} getStepDetail={ig.getStepDetail}
                  hashtags={ig.hashtags}
                />
                <IGScoringPanel result={ig.result} partialScores={ig.partialScores} />
                <IGOutputPanel
                  result={ig.result} loading={ig.loading} language={language}
                  hashtags={ig.hashtags}
                  onRefine={() => ig.handleRefine(topic, language)}
                  onCopy={handleIGCopy}
                />
              </div>
            )}

            {!ig.loading && !ig.result && (
              <IGEmptyState />
            )}
          </div>
        )}

        {/* IG: Growth Copilot */}
        {tab === 'ig_copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <IGCopilot
              data={igCopilotData} loading={igCopilotLoading} error={ig.error}
              onRefresh={() => { setIGCopilotData(null); fetchIGCopilot(); }}
              onRetry={() => { ig.setError(null); fetchIGCopilot(); }}
            />
          </div>
        )}

        {/* IG: Scheduler */}
        {tab === 'ig_scheduler' && (
          <div className="max-w-5xl mx-auto">
            <IGScheduler />
          </div>
        )}

        {/* IG: Competitor */}
        {tab === 'ig_competitor' && (
          <div className="max-w-5xl mx-auto">
            <IGCompetitor />
          </div>
        )}

      </main>

      <footer className="border-t border-slate-200/60 mt-12 py-4 text-center text-xs text-slate-400">
        {isIG
          ? 'Instagram Engine · 9-agent pipeline · AWS Bedrock'
          : 'Content Engine · Multi-agent pipeline · AWS Bedrock + LangGraph'}
      </footer>
    </div>
  );
}

function IGEmptyState() {
  const { Instagram } = require('lucide-react');
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 mb-6">
        <Instagram className="w-10 h-10 text-pink-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Instagram Content Engine</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
        Enter a topic. The 9-agent pipeline auto-selects Reel / Carousel / Static,
        writes your caption, generates 20–30 hashtags, and creates a visual.
      </p>
      <div className="flex items-center justify-center gap-5 mt-8 text-xs text-slate-400 flex-wrap">
        {['Auto Format', 'Competitor Intel', 'Viral Hook', '20–30 Hashtags', 'Reel Script', 'Carousel Slides', 'A/B Captions'].map(f => (
          <span key={f} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />{f}
          </span>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Zap, AlertTriangle } from 'lucide-react';

import { LANGUAGES, API_BASE } from './constants/pipeline';
import { IG_API_BASE, IG_LANGUAGES, IG_FORMAT_COLORS, IG_TONE_COLORS } from './constants/ig_pipeline';
import { usePipeline } from './hooks/usePipeline';
import { useIGPipeline } from './hooks/useIGPipeline';

import Header from './components/Header';
import AgentWorkflow from './components/AgentWorkflow';
import ScoringPanel from './components/ScoringPanel';
import FinalPostPanel from './components/FinalPostPanel';
import GrowthCopilot from './components/GrowthCopilot';
import IGWorkflow from './components/IGWorkflow';
import IGScoringPanel from './components/IGScoringPanel';
import IGOutputPanel from './components/IGOutputPanel';
import IGCopilot from './components/IGCopilot';
import IGScheduler from './components/IGScheduler';
import IGCompetitor from './components/IGCompetitor';

const DEFAULT_TOPICS = {
  linkedin: "Why India's SaaS founders are betting big on AI agents",
  instagram: '5 money habits every Indian 20-something needs to build',
};

const SAMPLE_TOPICS = {
  linkedin: [
    "How Indian B2B startups can adopt AI agents in 30 days",
    "3 lessons from building for India's SMB market",
    'Why founder-led content still wins in 2026',
  ],
  instagram: [
    '5 money habits every Indian 20-something needs to build',
    'How to build a 30-second morning routine that sticks',
    '3 creator growth mistakes and how to fix them',
  ],
};

export default function App() {
  const [platform, setPlatform] = useState('linkedin');
  const [tab, setTab] = useState('generator');
  const [topic, setTopic] = useState(DEFAULT_TOPICS.linkedin);
  const [language, setLanguage] = useState('English');

  const handlePlatformChange = (nextPlatform) => {
    setPlatform(nextPlatform);
    setTab(nextPlatform === 'instagram' ? 'ig_generator' : 'generator');
    setTopic(DEFAULT_TOPICS[nextPlatform]);
  };

  const li = usePipeline();
  const ig = useIGPipeline();
  const setLiError = li.setError;
  const setIgError = ig.setError;

  const toUnicodeBold = (text) =>
    [...text].map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
      return ch;
    }).join('');

  const toUnicodeItalic = (text) =>
    [...text].map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d608 + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d622 + c - 97);
      return ch;
    }).join('');

  const toLinkedInText = (md) =>
    md
      .replace(/^#{1,6}\s+(.+)/gm, (_, t) => toUnicodeBold(t))
      .replace(/\*\*(.+?)\*\*/g, (_, t) => toUnicodeBold(t))
      .replace(/__(.+?)__/g, (_, t) => toUnicodeBold(t))
      .replace(/\*(.+?)\*/g, (_, t) => toUnicodeItalic(t))
      .replace(/_(.+?)_/g, (_, t) => toUnicodeItalic(t))
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/^\s*[-*+]\s+/gm, '- ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const handleLICopy = () => {
    let body = li.result?.final_post || '';
    if (li.result?.hook) {
      body = body
        .replace(li.result.hook, '')
        .replace(`**${li.result.hook}**`, '')
        .replace(/^\s*\n/, '');
    }
    const text = li.result?.hook ? `${toUnicodeBold(li.result.hook)}\n\n${body}` : body;
    navigator.clipboard.writeText(toLinkedInText(text));
  };

  const handleIGCopy = () => {
    if (!ig.result) return;
    const full = [
      ig.result.hook ? `${ig.result.hook}\n\n` : '',
      ig.result.caption || '',
      ig.result.hashtags?.caption_block || '',
    ].join('');
    navigator.clipboard.writeText(full);
  };

  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [igCopilotData, setIGCopilotData] = useState(null);
  const [igCopilotLoading, setIGCopilotLoading] = useState(false);

  const fetchLICopilot = useCallback(async () => {
    setCopilotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/copilot`);
      const data = await res.json();
      if (!res.ok || data.error) setLiError(data.error || 'Copilot failed');
      else {
        setCopilotData(data);
        setLiError(null);
      }
    } catch {
      setLiError('Failed to connect to LinkedIn backend.');
    }
    setCopilotLoading(false);
  }, [setLiError]);

  const fetchIGCopilot = useCallback(async () => {
    setIGCopilotLoading(true);
    try {
      const res = await fetch(`${IG_API_BASE}/api/ig/copilot`);
      const data = await res.json();
      if (data.error) setIgError(data.error);
      else {
        setIGCopilotData(data);
        setIgError(null);
      }
    } catch {
      setIgError('Failed to connect to Instagram API.');
    }
    setIGCopilotLoading(false);
  }, [setIgError]);

  useEffect(() => {
    if (tab === 'copilot' && !copilotData) fetchLICopilot();
    if (tab === 'ig_copilot' && !igCopilotData) fetchIGCopilot();
  }, [tab, copilotData, igCopilotData, fetchLICopilot, fetchIGCopilot]);

  const isIG = platform === 'instagram';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Header
        tab={tab}
        onTabChange={setTab}
        platform={platform}
        onPlatformChange={handlePlatformChange}
      />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        {tab === 'generator' && (
          <div className="space-y-6">
            <div className="ui-card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                className="ui-control flex-grow"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter your post topic"
                onKeyDown={(e) => e.key === 'Enter' && !li.loading && li.handleGenerate(topic, language)}
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="ui-control sm:min-w-[120px] focus:ring-indigo-500/30 focus:border-indigo-400"
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={() => li.handleGenerate(topic, language)}
                disabled={li.loading || !topic.trim()}
                className="ui-btn-linkedin px-7 py-3.5 w-full sm:w-auto"
              >
                {li.loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  : <><Zap className="w-4 h-4" /> Generate Post</>}
              </button>
            </div>

            {!li.result && !li.loading && (
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TOPICS.linkedin.map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setTopic(sample)}
                    className="ui-btn-secondary"
                  >
                    Use Sample
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className="ui-trust-chip">Model: AWS Bedrock</span>
              <span className="ui-trust-chip">Quality gate: 75%</span>
              <span className="ui-trust-chip">Live progress: SSE</span>
            </div>

            {li.error && (
              <div className="ui-alert-error flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{li.error}</p>
                  <p className="text-xs text-red-500 mt-1">Start `backend/main.py` on port 8000, then retry.</p>
                </div>
              </div>
            )}

            {(li.loading || li.result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <AgentWorkflow
                  loading={li.loading}
                  result={li.result}
                  currentIteration={li.currentIteration}
                  reflexionHistory={li.reflexionHistory}
                  searchData={li.searchData}
                  partialCritiques={li.partialCritiques}
                  getStepStatus={li.getStepStatus}
                  getStepDetail={li.getStepDetail}
                  language={language}
                />
                <ScoringPanel result={li.result} partialScores={li.partialScores} />
                <FinalPostPanel
                  result={li.result}
                  loading={li.loading}
                  language={language}
                  onRefine={() => li.handleRefine(topic, language)}
                  onCopy={handleLICopy}
                />
              </div>
            )}

            {!li.loading && !li.result && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-indigo-100 mb-6">
                  <Zap className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Multi-Agent LinkedIn Content</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Enter a topic. The 9-agent pipeline drafts, localizes, critiques, scores, and optimizes your LinkedIn post.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <GrowthCopilot
              data={copilotData}
              loading={copilotLoading}
              error={li.error}
              onRefresh={() => { setCopilotData(null); fetchLICopilot(); }}
              onRetry={() => { setLiError(null); fetchLICopilot(); }}
            />
          </div>
        )}

        {tab === 'ig_generator' && (
          <div className="space-y-6">
            <div className="ui-card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
              <input
                className="ui-control flex-grow focus:ring-pink-400/30 focus:border-pink-400"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter your post topic"
                onKeyDown={(e) => e.key === 'Enter' && !ig.loading && ig.handleGenerate(topic, language)}
              />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="ui-control sm:min-w-[120px] focus:ring-pink-400/30 focus:border-pink-400"
              >
                {IG_LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={() => ig.handleGenerate(topic, language)}
                disabled={ig.loading || !topic.trim()}
                className="ui-btn-instagram px-7 py-3.5 w-full sm:w-auto"
              >
                {ig.loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  : <><Zap className="w-4 h-4" /> Generate Post</>}
              </button>
            </div>

            {!ig.result && !ig.loading && (
              <div className="flex flex-wrap gap-2">
                {SAMPLE_TOPICS.instagram.map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setTopic(sample)}
                    className="ui-btn-secondary"
                  >
                    Use Sample
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <span className="ui-trust-chip">Auto format + tone selection</span>
              <span className="ui-trust-chip">20-30 hashtags per post</span>
              <span className="ui-trust-chip">Score and refine loop</span>
            </div>

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
              <div className="ui-alert-error flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{ig.error}</p>
                  <p className="text-xs text-red-500 mt-1">Start `backend/main.py` on port 8000, then retry.</p>
                </div>
              </div>
            )}

            {(ig.loading || ig.result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <IGWorkflow
                  loading={ig.loading}
                  result={ig.result}
                  currentIteration={ig.currentIteration}
                  reflexionHistory={ig.reflexionHistory}
                  searchData={ig.searchData}
                  partialCritiques={ig.partialCritiques}
                  getStepStatus={ig.getStepStatus}
                  getStepDetail={ig.getStepDetail}
                  hashtags={ig.hashtags}
                />
                <IGScoringPanel result={ig.result} partialScores={ig.partialScores} />
                <IGOutputPanel
                  result={ig.result}
                  loading={ig.loading}
                  language={language}
                  hashtags={ig.hashtags}
                  onRefine={() => ig.handleRefine(topic, language)}
                  onCopy={handleIGCopy}
                />
              </div>
            )}

            {!ig.loading && !ig.result && <IGEmptyState />}
          </div>
        )}

        {tab === 'ig_copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <IGCopilot
              data={igCopilotData}
              loading={igCopilotLoading}
              error={ig.error}
              onRefresh={() => { setIGCopilotData(null); fetchIGCopilot(); }}
              onRetry={() => { setIgError(null); fetchIGCopilot(); }}
            />
          </div>
        )}

        {tab === 'ig_scheduler' && (
          <div className="max-w-5xl mx-auto">
            <IGScheduler />
          </div>
        )}

        {tab === 'ig_competitor' && (
          <div className="max-w-5xl mx-auto">
            <IGCompetitor />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200/60 mt-12 py-4 text-center text-xs text-slate-400">
        {isIG
          ? 'Instagram Engine | 9-agent pipeline | AWS Bedrock'
          : 'Content Engine | Multi-agent pipeline | AWS Bedrock + LangGraph'}
      </footer>
    </div>
  );
}

function IGEmptyState() {
  const { Instagram } = require('lucide-react');
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-pink-100 mb-6">
        <Instagram className="w-10 h-10 text-pink-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Instagram Content Engine</h2>
      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
        Enter a topic. The 9-agent pipeline auto-selects Reel, Carousel, or Static format,
        writes your caption, generates 20-30 hashtags, and creates a visual.
      </p>
      <div className="flex items-center justify-center gap-5 mt-8 text-xs text-slate-400 flex-wrap">
        {['Auto Format', 'Competitor Intel', 'Viral Hook', '20-30 Hashtags', 'Reel Script', 'Carousel Slides', 'A/B Captions'].map((f) => (
          <span key={f} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />{f}
          </span>
        ))}
      </div>
    </div>
  );
}

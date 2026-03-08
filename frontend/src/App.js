import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Zap, AlertTriangle, Search } from 'lucide-react';

import { LANGUAGES, API_BASE } from './constants/pipeline';
import { usePipeline } from './hooks/usePipeline';
import Header from './components/Header';
import AgentWorkflow from './components/AgentWorkflow';
import ScoringPanel from './components/ScoringPanel';
import FinalPostPanel from './components/FinalPostPanel';
import GrowthCopilot from './components/GrowthCopilot';

// ─── Main Application ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('generator');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');

  // Pipeline hook
  const {
    result, loading, error, partialScores, partialCritiques,
    currentIteration, reflexionHistory, searchData,
    handleGenerate: generate, handleRefine: refine,
    getStepStatus, getStepDetail, setError,
  } = usePipeline();

  // Copilot State
  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const onGenerate = () => generate(topic, language);
  const onRefine = () => refine(topic, language);

  // Convert text to Unicode Bold (Sans-Serif Bold) for LinkedIn compatibility
  const toUnicodeBold = (text) =>
    [...text].map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D5D4 + code - 65);  // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D5EE + code - 97);  // a-z
      if (code >= 48 && code <= 57)  return String.fromCodePoint(0x1D7EC + code - 48);  // 0-9
      return ch;
    }).join('');

  // Convert text to Unicode Italic (Sans-Serif Italic) for LinkedIn compatibility
  const toUnicodeItalic = (text) =>
    [...text].map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 65 && code <= 90)  return String.fromCodePoint(0x1D608 + code - 65);  // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D622 + code - 97);  // a-z
      return ch;
    }).join('');

  // Convert markdown to LinkedIn-friendly Unicode text
  const toLinkedInText = (md) =>
    md
      .replace(/^#{1,6}\s+(.+)/gm, (_, t) => toUnicodeBold(t)) // headers → bold
      .replace(/\*\*(.+?)\*\*/g, (_, t) => toUnicodeBold(t))   // **bold** → 𝗯𝗼𝗹𝗱
      .replace(/__(.+?)__/g, (_, t) => toUnicodeBold(t))        // __bold__ → 𝗯𝗼𝗹𝗱
      .replace(/\*(.+?)\*/g, (_, t) => toUnicodeItalic(t))      // *italic* → 𝘪𝘵𝘢𝘭𝘪𝘤
      .replace(/_(.+?)_/g, (_, t) => toUnicodeItalic(t))        // _italic_ → 𝘪𝘵𝘢𝘭𝘪𝘤
      .replace(/~~(.+?)~~/g, '$1')        // strikethrough → plain
      .replace(/`(.+?)`/g, '$1')          // inline code → plain
      .replace(/^\s*[-*+]\s+/gm, '• ')   // unordered lists → bullet
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links: [text](url) → text

  const handleCopy = () => {
    let body = result?.final_post || '';
    if (result?.hook) {
      body = body.replace(result.hook, '').replace(`**${result.hook}**`, '').replace(/^\s*\n/, '');
    }
    const text = result?.hook ? toUnicodeBold(result.hook) + '\n\n' + body : body;
    navigator.clipboard.writeText(toLinkedInText(text));
  };

  const fetchCopilot = useCallback(async () => {
    setCopilotLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/copilot`);
      const data = await response.json();
      if (!response.ok || data.error) {
        setError(data.error || 'Copilot API request failed');
      } else {
        setCopilotData(data);
        setError(null);
      }
    } catch (err) {
      console.error('Copilot API Error:', err);
      setError('Failed to connect to Copilot API');
    }
    setCopilotLoading(false);
  }, [setError]);

  useEffect(() => {
    if (tab === 'copilot' && !copilotData) fetchCopilot();
  }, [tab, copilotData, fetchCopilot]);

  return (
    <div className="min-h-screen text-slate-100 font-sans relative overflow-hidden bg-[#030313]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(168,85,247,0.25) 0%, transparent 35%), radial-gradient(circle at 80% 15%, rgba(59,130,246,0.22) 0%, transparent 30%), radial-gradient(circle at 70% 80%, rgba(217,70,239,0.22) 0%, transparent 38%)' }} />
        <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.55) 0.8px, transparent 0.8px)', backgroundSize: '3px 3px' }} />
      </div>

      {tab === 'copilot' && <Header tab={tab} onTabChange={setTab} />}

      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 relative z-10">
        {/* ═══ CONTENT ENGINE TAB ═══ */}
        {tab === 'generator' && (
          <div className="space-y-6 rounded-[22px] border border-indigo-400/45 bg-[#070726]/80 backdrop-blur-xl p-4 md:p-5 shadow-[0_0_40px_rgba(139,92,246,0.28)]">
            {/* Input Bar */}
            <div className="bg-[#090a31]/80 p-2 rounded-2xl shadow-[0_0_30px_rgba(129,140,248,0.28)] border border-indigo-400/45 flex flex-col md:flex-row gap-2 md:gap-3 items-stretch md:items-center">
              <button
                onClick={() => setTab('copilot')}
                className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-xl border border-indigo-300/35 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25"
                title="Open Growth Copilot"
              >
                <Zap className="w-4 h-4" />
              </button>
              <div className="flex-grow relative">
                <Search className="w-4 h-4 text-indigo-200/70 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  className="w-full border border-indigo-400/50 p-3.5 pl-11 pr-4 rounded-xl bg-[#0a0b3a]/85 text-xl font-medium text-slate-100 placeholder:text-indigo-200/65 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/45 focus:border-fuchsia-300 transition"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="what’s new in AI today?"
                  onKeyDown={(e) => e.key === 'Enter' && !loading && onGenerate()}
                />
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border border-indigo-400/45 p-3.5 rounded-xl bg-[#0a0b3a]/85 text-lg font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-fuchsia-300 transition min-w-[140px]"
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={onGenerate}
                disabled={loading || !topic.trim()}
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 disabled:from-slate-500 disabled:to-slate-600 text-white px-7 py-3.5 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(217,70,239,0.55)] disabled:shadow-none"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Orchestrating...</> : <><Zap className="w-4 h-4" /> Orchestrate Content</>}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-red-500/10 border border-red-300/40 rounded-2xl p-5 flex items-start gap-3 backdrop-blur-sm">
                <AlertTriangle className="w-5 h-5 text-red-300 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-200">Pipeline Error</p>
                  <p className="text-sm text-red-100/90 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Three-Column Layout */}
            {(loading || result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <AgentWorkflow
                  loading={loading} result={result}
                  currentIteration={currentIteration} reflexionHistory={reflexionHistory}
                  searchData={searchData} partialCritiques={partialCritiques}
                  getStepStatus={getStepStatus} getStepDetail={getStepDetail}
                  language={language}
                />
                <ScoringPanel result={result} partialScores={partialScores} />
                <FinalPostPanel
                  result={result} loading={loading} language={language}
                  onRefine={onRefine} onCopy={handleCopy}
                />
              </div>
            )}

            {/* Empty State */}
            {!loading && !result && (
              <div className="text-center py-16 md:py-20 rounded-2xl border border-indigo-400/30 bg-slate-950/40">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 mb-6 border border-indigo-300/50 shadow-[0_0_20px_rgba(129,140,248,0.45)]">
                  <Zap className="w-10 h-10 text-indigo-200" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Multi-Agent Content Orchestration</h2>
                <p className="text-sm text-indigo-100/80 max-w-xl mx-auto leading-relaxed">
                  Enter a topic above. Our 7-agent LangGraph pipeline will draft, localize, critique,
                  score, and optimize your LinkedIn post — all powered by Claude on AWS Bedrock.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ GROWTH COPILOT TAB ═══ */}
        {tab === 'copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <GrowthCopilot
              data={copilotData}
              loading={copilotLoading}
              error={error}
              onRefresh={() => { setCopilotData(null); fetchCopilot(); }}
              onRetry={() => { setError(null); fetchCopilot(); }}
            />
          </div>
        )}
      </main>

      <footer className="border-t border-indigo-400/20 mt-12 py-4 text-center text-xs text-indigo-100/60 relative z-10">
        Content Engine • Multi-Agent Content Engine • Powered by AWS Bedrock + LangGraph
      </footer>
    </div>
  );
}

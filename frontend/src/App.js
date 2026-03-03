import React, { useState, useEffect } from 'react';
import { Loader2, Zap, AlertTriangle } from 'lucide-react';

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

  const fetchCopilot = async () => {
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
  };

  useEffect(() => {
    if (tab === 'copilot' && !copilotData) fetchCopilot();
  }, [tab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 font-sans">
      <Header tab={tab} onTabChange={setTab} />

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* ═══ CONTENT ENGINE TAB ═══ */}
        {tab === 'generator' && (
          <div className="space-y-6">
            {/* Input Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex gap-3 items-center">
              <div className="flex-grow relative">
                <input
                  className="w-full border border-slate-200 p-3.5 pl-4 pr-4 rounded-xl bg-slate-50/50 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Why India's SaaS founders are betting big on AI agents"
                  onKeyDown={(e) => e.key === 'Enter' && !loading && onGenerate()}
                />
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition min-w-[120px]"
              >
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={onGenerate}
                disabled={loading || !topic.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 shadow-md shadow-indigo-200/50 disabled:shadow-none"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Orchestrating...</> : <><Zap className="w-4 h-4" /> Orchestrate Content</>}
              </button>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Three-Column Layout */}
            {(loading || result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
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
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
                  <Zap className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Multi-Agent Content Orchestration</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
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

      <footer className="border-t border-slate-200/60 mt-12 py-4 text-center text-xs text-slate-400">
        Content Engine • Multi-Agent Content Engine • Powered by AWS Bedrock + LangGraph
      </footer>
    </div>
  );
}

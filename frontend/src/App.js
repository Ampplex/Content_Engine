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

export default function App() {
  const [platform, setPlatform] = useState('linkedin');
  const [tab, setTab] = useState('generator');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('English');
  const [theme, setTheme] = useState(localStorage.getItem('ui_theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('ui_theme', theme);
  }, [theme]);

  const li = usePipeline();
  const ig = useIGPipeline();

  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [igCopilotData, setIGCopilotData] = useState(null);
  const [igCopilotLoading, setIGCopilotLoading] = useState(false);

  const handlePlatformChange = (p) => {
    setPlatform(p);
    setTab(p === 'instagram' ? 'ig_generator' : 'generator');
    setTopic('');
  };

  const fetchLICopilot = useCallback(async () => {
    setCopilotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/copilot`);
      const data = await res.json();
      if (!res.ok || data.error) li.setError(data.error || 'Copilot failed');
      else {
        setCopilotData(data);
        li.setError(null);
      }
    } catch {
      li.setError('Failed to connect to LinkedIn backend.');
    }
    setCopilotLoading(false);
  }, [li]);

  const fetchIGCopilot = useCallback(async () => {
    setIGCopilotLoading(true);
    try {
      const res = await fetch(`${IG_API_BASE}/api/ig/copilot`);
      const data = await res.json();
      if (data.error) ig.setError(data.error);
      else {
        setIGCopilotData(data);
        ig.setError(null);
      }
    } catch {
      ig.setError('Failed to connect to Instagram API.');
    }
    setIGCopilotLoading(false);
  }, [ig]);

  useEffect(() => {
    if (tab === 'copilot' && !copilotData) fetchLICopilot();
    if (tab === 'ig_copilot' && !igCopilotData) fetchIGCopilot();
  }, [tab, copilotData, igCopilotData, fetchLICopilot, fetchIGCopilot]);

  const handleLICopy = () => {
    const text = li.result?.hook
      ? `${li.result.hook}\n\n${(li.result.final_post || '').replace(li.result.hook, '').replace(`**${li.result.hook}**`, '')}`
      : (li.result?.final_post || '');
    navigator.clipboard.writeText(text);
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

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${isDark ? 'bg-[#030313] text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <Header
        tab={tab}
        onTabChange={setTab}
        platform={platform}
        onPlatformChange={handlePlatformChange}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {tab === 'generator' && (
          <>
            <div className={`p-4 rounded-2xl border flex gap-3 items-center ${isDark ? 'bg-[#090a31]/80 border-indigo-400/45' : 'bg-white border-slate-200/70'}`}>
              <input
                className={`flex-grow p-3.5 rounded-xl border text-sm font-medium focus:outline-none ${isDark ? 'bg-[#0a0b3a]/85 border-indigo-400/50 text-slate-100 placeholder:text-indigo-200/65' : 'bg-slate-50/50 border-slate-200 placeholder:text-slate-400'}`}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter topic..."
                onKeyDown={(e) => e.key === 'Enter' && !li.loading && li.handleGenerate(topic, language)}
              />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`p-3.5 rounded-xl border text-sm ${isDark ? 'bg-[#0a0b3a]/85 border-indigo-400/45' : 'bg-slate-50/50 border-slate-200'}`}>
                {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
              </select>
              <button
                onClick={() => li.handleGenerate(topic, language)}
                disabled={li.loading || !topic.trim()}
                className={`px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition ${isDark ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} disabled:opacity-60`}
              >
                {li.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Orchestrating…</> : <><Zap className="w-4 h-4" /> Orchestrate</>}
              </button>
            </div>

            {li.error && (
              <div className={`${isDark ? 'bg-red-500/10 border-red-300/40 text-red-100' : 'bg-red-50 border-red-200 text-red-700'} border rounded-2xl p-5 flex items-start gap-3`}>
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <p className="text-sm">{li.error}</p>
              </div>
            )}

            {(li.loading || li.result) ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <AgentWorkflow theme={theme} loading={li.loading} result={li.result} currentIteration={li.currentIteration} reflexionHistory={li.reflexionHistory} searchData={li.searchData} partialCritiques={li.partialCritiques} getStepStatus={li.getStepStatus} getStepDetail={li.getStepDetail} language={language} />
                <ScoringPanel theme={theme} result={li.result} partialScores={li.partialScores} />
                <FinalPostPanel theme={theme} result={li.result} loading={li.loading} language={language} onRefine={() => li.handleRefine(topic, language)} onCopy={handleLICopy} />
              </div>
            ) : (
              <div className={`text-center py-20 rounded-2xl border ${isDark ? 'border-indigo-400/30 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
                <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Multi-Agent Content Orchestration</h2>
              </div>
            )}
          </>
        )}

        {tab === 'copilot' && <GrowthCopilot theme={theme} data={copilotData} loading={copilotLoading} error={li.error} onRefresh={() => { setCopilotData(null); fetchLICopilot(); }} onRetry={() => { li.setError(null); fetchLICopilot(); }} />}

        {tab === 'ig_generator' && (
          <>
            <div className={`${isDark ? 'bg-[#0b0a2f]/80 border-pink-300/30' : 'bg-white border-pink-100/80'} p-4 rounded-2xl shadow-sm border flex gap-3 items-center`}>
              <input
                className={`flex-grow border p-3.5 rounded-xl text-sm ${isDark ? 'bg-slate-900/60 border-slate-600 text-slate-100 placeholder:text-slate-400' : 'bg-slate-50/50 border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Instagram topic..."
                onKeyDown={(e) => e.key === 'Enter' && !ig.loading && ig.handleGenerate(topic, language)}
              />
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`border p-3.5 rounded-xl text-sm ${isDark ? 'bg-slate-900/60 border-slate-600 text-slate-100' : 'bg-slate-50/50 border-slate-200 text-slate-800'}`}>{IG_LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
              <button onClick={() => ig.handleGenerate(topic, language)} disabled={ig.loading || !topic.trim()} className="bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white px-7 py-3.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition">{ig.loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <><Zap className="w-4 h-4" /> Create</>}</button>
            </div>

            {(ig.selectedFormat || ig.selectedTone) && (
              <div className="flex items-center gap-2">
                {ig.selectedFormat && <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${IG_FORMAT_COLORS[ig.selectedFormat] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{ig.selectedFormat}</span>}
                {ig.selectedTone && <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${IG_TONE_COLORS[ig.selectedTone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{ig.selectedTone}</span>}
              </div>
            )}

            {(ig.loading || ig.result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <IGWorkflow loading={ig.loading} result={ig.result} currentIteration={ig.currentIteration} reflexionHistory={ig.reflexionHistory} searchData={ig.searchData} partialCritiques={ig.partialCritiques} getStepStatus={ig.getStepStatus} getStepDetail={ig.getStepDetail} hashtags={ig.hashtags} />
                <IGScoringPanel result={ig.result} partialScores={ig.partialScores} />
                <IGOutputPanel result={ig.result} loading={ig.loading} language={language} hashtags={ig.hashtags} onRefine={() => ig.handleRefine(topic, language)} onCopy={handleIGCopy} />
              </div>
            )}
          </>
        )}

        {tab === 'ig_copilot' && <IGCopilot data={igCopilotData} loading={igCopilotLoading} error={ig.error} onRefresh={() => { setIGCopilotData(null); fetchIGCopilot(); }} onRetry={() => { ig.setError(null); fetchIGCopilot(); }} />}
        {tab === 'ig_scheduler' && <IGScheduler theme={theme} />}
        {tab === 'ig_competitor' && <IGCompetitor />}
      </main>
    </div>
  );
}

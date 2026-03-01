import React, { useState, useEffect } from 'react';
import {
  Activity, BrainCircuit, LineChart, CheckCircle, Zap, Shield, Search,
  Eye, ChevronRight, Loader2, Sparkles, BarChart3, Globe2,
  AlertTriangle, RefreshCw, Copy, TrendingDown, TrendingUp
} from 'lucide-react';

// ─── Agentic Pipeline Steps (for the thought-process timeline) ────────────────
const PIPELINE_STEPS = [
  { id: 'drafting',     label: 'Content Drafter',       icon: Sparkles,    desc: 'Generating English draft from topic...' },
  { id: 'localization', label: 'Indic Localizer',       icon: Globe2,      desc: 'Translating & culturally adapting...' },
  { id: 'seo',          label: 'SEO Optimizer',         icon: Search,      desc: 'Analyzing hashtags & keywords...' },
  { id: 'brand',        label: 'Brand Guardian',        icon: Shield,      desc: 'Reviewing tone & professionalism...' },
  { id: 'ethics',       label: 'Ethics & Safety Agent', icon: AlertTriangle, desc: 'Checking bias & compliance...' },
  { id: 'scoring',      label: 'Hybrid Scoring Engine', icon: BarChart3,   desc: 'Computing engagement prediction...' },
  { id: 'visuals',      label: 'Visual Strategist',     icon: Eye,         desc: 'Crafting image generation prompt...' },
];

// ─── Score Bar Component ──────────────────────────────────────────────────────
function ScoreBar({ label, score, color, weight }) {
  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">w={weight}</span>
          <span className="text-sm font-semibold text-slate-800">{(score * 100).toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── Pipeline Step Component ──────────────────────────────────────────────────
function PipelineStep({ step, status, detail, isLast }) {
  const Icon = step.icon;
  const isActive = status === 'active';
  const isDone = status === 'done';

  return (
    <div className="flex gap-3">
      {/* Vertical line + dot */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
          isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
          isActive ? 'bg-indigo-500 border-indigo-500 text-white animate-pulse' :
          'bg-white border-slate-200 text-slate-400'
        }`}>
          {isDone ? <CheckCircle className="w-4 h-4" /> :
           isActive ? <Loader2 className="w-4 h-4 animate-spin" /> :
           <Icon className="w-4 h-4" />}
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-grow min-h-[24px] transition-colors duration-300 ${
            isDone ? 'bg-emerald-300' : 'bg-slate-200'
          }`} />
        )}
      </div>

      {/* Content */}
      <div className={`pb-5 ${isLast ? '' : ''}`}>
        <p className={`text-sm font-semibold ${isDone ? 'text-slate-800' : isActive ? 'text-indigo-700' : 'text-slate-400'}`}>
          {step.label}
        </p>
        <p className={`text-xs mt-0.5 leading-relaxed ${isDone ? 'text-slate-600' : isActive ? 'text-indigo-500' : 'text-slate-300'}`}>
          {detail || step.desc}
        </p>
      </div>
    </div>
  );
}

// ─── Main Application ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('generator');

  // Generator State
  const [topic, setTopic] = useState('How AI agents are transforming Indian agriculture');
  const [language, setLanguage] = useState('English');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [partialScores, setPartialScores] = useState(null);
  const [partialCritiques, setPartialCritiques] = useState(null);

  // Copilot State
  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    setActiveStep(0);
    setCompletedSteps(new Set());
    setPartialScores(null);
    setPartialCritiques(null);

    try {
      const response = await fetch('http://localhost:8000/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, target_language: language }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        let eventType = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'node_done') {
                const stepIdx = data.step;
                setCompletedSteps(prev => new Set([...prev, stepIdx]));
                // Set next step as active
                setActiveStep(stepIdx + 1);
              }

              if (eventType === 'scores') {
                setPartialScores(data);
              }

              if (eventType === 'critiques') {
                setPartialCritiques(data.critiques);
              }

              if (eventType === 'complete') {
                setResult(data);
                setActiveStep(PIPELINE_STEPS.length);
                // Mark all steps done
                setCompletedSteps(new Set([0, 1, 2, 3, 4, 5, 6]));
              }

              if (eventType === 'error') {
                setError(data.error);
                setActiveStep(-1);
              }
            } catch (e) {
              // ignore parse errors on partial data
            }
            eventType = null;
          }
        }
      }
    } catch (err) {
      console.error('API Error:', err);
      setError('Failed to connect to backend. Is the server running?');
      setActiveStep(-1);
    }
    setLoading(false);
  };

  const fetchCopilot = async () => {
    setCopilotLoading(true);
    try {
      const response = await fetch('http://localhost:8000/api/copilot');
      const data = await response.json();
      setCopilotData(data);
    } catch (error) {
      console.error('Copilot API Error:', error);
    }
    setCopilotLoading(false);
  };

  useEffect(() => {
    if (tab === 'copilot' && !copilotData) fetchCopilot();
  }, [tab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(result?.final_post || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStepStatus = (index) => {
    if (completedSteps.has(index)) return 'done';
    if (index === activeStep && loading) return 'active';
    return 'pending';
  };

  const getStepDetail = (index) => {
    const critiques = result?.critiques || partialCritiques;
    const scores = result?.scores || partialScores;
    // Map critique results to the appropriate pipeline step
    if (index === 2 && critiques?.[0]) return critiques[0];
    if (index === 3 && critiques?.[1]) return critiques[1];
    if (index === 4 && critiques?.[2]) return critiques[2];
    if (index === 5 && scores) return `Final Score: ${(scores.final * 100).toFixed(1)}%`;
    if (index === 6 && (result?.image_prompt)) return result.image_prompt.slice(0, 120) + '...';
    if (index === 0 && completedSteps.has(0)) return 'English draft generated successfully.';
    if (index === 1 && completedSteps.has(1)) return `Localized to ${language} for Indian professionals.`;
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 font-sans">
      {/* ─── Top Navigation ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Activity className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">Hybrid OS</h1>
              <p className="text-[11px] text-slate-400 font-medium -mt-0.5 tracking-wide">AI for Bharat • Content Engine</p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setTab('generator')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                tab === 'generator' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <BrainCircuit className="w-4 h-4" /> Content Engine
            </button>
            <button
              onClick={() => setTab('copilot')}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                tab === 'copilot' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LineChart className="w-4 h-4" /> Growth Copilot
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium border border-emerald-200/60">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
              Bedrock Connected
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-6">
        {/* ═══════════════════════════════════════════════════════════════════
            CONTENT ENGINE TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'generator' && (
          <div className="space-y-6">
            {/* ─── Input Bar ──────────────────────────────────────────────── */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex gap-3 items-center">
              <div className="flex-grow relative">
                <input
                  className="w-full border border-slate-200 p-3.5 pl-4 pr-4 rounded-xl bg-slate-50/50 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter your post topic..."
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerate()}
                />
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border border-slate-200 p-3.5 rounded-xl bg-slate-50/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition min-w-[120px]"
              >
                <option>Hindi</option>
                <option>Marathi</option>
                <option>Tamil</option>
                <option>Telugu</option>
                <option>Bengali</option>
                <option>Kannada</option>
                <option>English</option>
              </select>
              <button
                onClick={handleGenerate}
                disabled={loading || !topic.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 text-white px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 shadow-md shadow-indigo-200/50 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Orchestrating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Orchestrate Content
                  </>
                )}
              </button>
            </div>

            {/* ─── Error Banner ───────────────────────────────────────────── */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Pipeline Error</p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* ─── Three-Column Split Screen ──────────────────────────────── */}
            {(loading || result) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

                {/* ── LEFT: Agent Workflow / Thought Process ────────────── */}
                <div className="lg:col-span-4 space-y-5">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-purple-50/80">
                      <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
                        <BrainCircuit className="w-4 h-4 text-indigo-600" />
                        Agentic Thought Process
                      </h2>
                      {result && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-md font-semibold">
                            <RefreshCw className="w-3 h-3 inline mr-1" />
                            {result.iterations} Reflexion {result.iterations === 1 ? 'Pass' : 'Passes'}
                          </span>
                          <span className="text-xs text-slate-400">7 agents executed</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5">
                      {PIPELINE_STEPS.map((step, i) => (
                        <PipelineStep
                          key={step.id}
                          step={step}
                          status={getStepStatus(i)}
                          detail={getStepDetail(i)}
                          isLast={i === PIPELINE_STEPS.length - 1}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Agent Critiques Detail */}
                  {(result?.critiques || partialCritiques) && (() => {
                    const critiques = result?.critiques || partialCritiques;
                    return (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                          <Shield className="w-4 h-4 text-purple-500" />
                          Agent Review Details
                        </h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {critiques.map((critique, i) => {
                          const icons = [Search, Shield, AlertTriangle];
                          const colors = ['text-blue-500', 'text-purple-500', 'text-amber-500'];
                          const bgColors = ['bg-blue-50', 'bg-purple-50', 'bg-amber-50'];
                          const Icon = icons[i];
                          return (
                            <div key={i} className={`${bgColors[i]} rounded-xl p-3.5 border border-slate-100`}>
                              <div className="flex items-start gap-2.5">
                                <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${colors[i]}`} />
                                <p className="text-xs text-slate-700 leading-relaxed">{critique}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    );
                  })()}
                </div>

                {/* ── MIDDLE: Hybrid Scoring Math ──────────────────────── */}
                <div className="lg:col-span-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden h-full flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h2 className="font-semibold text-sm flex items-center gap-2 text-slate-800">
                        <BarChart3 className="w-4 h-4 text-indigo-600" />
                        Hybrid Scoring Breakdown
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-1 font-mono">
                        score = 0.5·ML + 0.3·LLM + 0.2·Heuristic
                      </p>
                    </div>

                    <div className="p-5 flex-grow">
                      {(result?.scores || partialScores) ? (() => {
                        const scores = result?.scores || partialScores;
                        return (
                        <>
                          <ScoreBar label="ML Feature Predictor" score={scores.ml} color="bg-blue-500" weight="0.5" />
                          <ScoreBar label="LLM Engagement Evaluator" score={scores.llm} color="bg-purple-500" weight="0.3" />
                          <ScoreBar label="Heuristics Engine" score={scores.heuristic} color="bg-amber-500" weight="0.2" />

                          {/* Divider */}
                          <div className="border-t border-dashed border-slate-200 my-6" />

                          {/* Final Score */}
                          <div className="text-center">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Predicted Engagement Score
                            </p>
                            <div className="relative inline-flex items-center justify-center">
                              <svg className="w-32 h-32" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                <circle
                                  cx="60" cy="60" r="50" fill="none"
                                  stroke={scores.final >= 0.75 ? '#6366f1' : '#f59e0b'}
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                  strokeDasharray={`${scores.final * 314} 314`}
                                  transform="rotate(-90 60 60)"
                                  className="transition-all duration-1000"
                                />
                              </svg>
                              <span className="absolute text-3xl font-black text-slate-900">
                                {(scores.final * 100).toFixed(0)}
                              </span>
                            </div>
                            <p className={`text-sm font-semibold mt-2 ${scores.final >= 0.75 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {scores.final >= 0.85 ? 'Excellent — Ready to publish' :
                               scores.final >= 0.75 ? 'Good — Passed quality gate' :
                               'Below threshold — Reflexion triggered'}
                            </p>
                          </div>

                          {/* Score Formula */}
                          <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Calculation</p>
                            <p className="text-xs text-slate-600 font-mono leading-loose">
                              (0.5 × {(scores.ml * 100).toFixed(1)}) + (0.3 × {(scores.llm * 100).toFixed(1)}) + (0.2 × {(scores.heuristic * 100).toFixed(1)})<br />
                              = <span className="font-bold text-indigo-600">{(scores.final * 100).toFixed(1)}</span>
                            </p>
                          </div>
                        </>
                        );
                      })() : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-12">
                          <BarChart3 className="w-12 h-12" />
                          <p className="text-sm font-medium">Scores will appear here</p>
                          <p className="text-xs text-slate-300">Waiting for pipeline to complete...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: Final Output ──────────────────────────────── */}
                <div className="lg:col-span-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden h-full flex flex-col">
                    <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                      <h2 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
                        <CheckCircle className="w-4 h-4" />
                        Final Localized Post
                      </h2>
                      {result && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={handleCopy}
                            className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5"
                          >
                            <Copy className="w-3 h-3" />
                            {copied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-grow flex flex-col">
                      {result ? (
                        <>
                          {/* Generated Image */}
                          <div className="relative rounded-xl overflow-hidden border border-slate-100 mb-4">
                            <img
                              src={result.image_url}
                              alt="AI Generated Visual"
                              className="w-full h-48 object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                              <p className="text-[10px] text-white/80 line-clamp-1">{result.image_prompt}</p>
                            </div>
                          </div>

                          {/* Post Content */}
                          <div className="flex-grow bg-gradient-to-b from-slate-50 to-white rounded-xl border border-slate-100 p-4 overflow-y-auto max-h-[400px]">
                            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">AI</div>
                              <div>
                                <p className="text-xs font-semibold text-slate-800">Hybrid OS Content Engine</p>
                                <p className="text-[10px] text-slate-400">Generated in {language}</p>
                              </div>
                            </div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {result.final_post}
                            </div>
                          </div>

                          {/* Language Badge */}
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium border border-indigo-100">
                              <Globe2 className="w-3 h-3 inline mr-1" />
                              {language}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {result.final_post?.length || 0} characters
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-12">
                          <Sparkles className="w-12 h-12" />
                          <p className="text-sm font-medium">Final post will appear here</p>
                          <p className="text-xs text-slate-300">Enter a topic and click Orchestrate</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && !result && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 mb-6">
                  <BrainCircuit className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Multi-Agent Content Orchestration</h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                  Enter a topic above. Our 7-agent LangGraph pipeline will draft, localize, critique,
                  score, and optimize your LinkedIn post — all powered by Claude on AWS Bedrock.
                </p>
                <div className="flex items-center justify-center gap-2 mt-6 text-xs text-slate-400">
                  {PIPELINE_STEPS.map((s, i) => (
                    <React.Fragment key={s.id}>
                      <span className="bg-slate-100 px-2.5 py-1 rounded-md font-medium">{s.label}</span>
                      {i < PIPELINE_STEPS.length - 1 && <ChevronRight className="w-3 h-3" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            GROWTH COPILOT TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {tab === 'copilot' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {copilotLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-sm text-slate-500 font-medium">Analyzing engagement patterns...</span>
              </div>
            )}

            {copilotData && (
              <>
                {/* Strategy Card */}
                <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white p-8 rounded-2xl shadow-lg shadow-indigo-200/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10">
                    <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <LineChart className="w-5 h-5" />
                      AI Strategic Recommendation
                    </h2>
                    <div className="bg-white/10 backdrop-blur-sm p-5 rounded-xl border border-white/20">
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{copilotData.strategy}</p>
                    </div>
                  </div>
                </div>

                {/* Engagement Trend Grid */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold text-sm text-slate-800">14-Day Engagement Timeline</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Tone distribution vs engagement performance</p>
                    </div>
                    <button
                      onClick={() => { setCopilotData(null); fetchCopilot(); }}
                      className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
                      {copilotData.recent_trend.map((day, i) => {
                        const rate = parseFloat(day.engagement_rate);
                        const isLow = rate < 3;
                        const isHigh = rate > 5;
                        const toneColors = {
                          'Educational': 'bg-blue-100 text-blue-700 border-blue-200',
                          'Promotional': 'bg-red-100 text-red-700 border-red-200',
                          'Story': 'bg-purple-100 text-purple-700 border-purple-200',
                          'Opinion': 'bg-amber-100 text-amber-700 border-amber-200',
                        };
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
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${toneColors[day.tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
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
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 mt-12 py-4 text-center text-xs text-slate-400">
        Hybrid OS • Multi-Agent Content Engine • Powered by AWS Bedrock + LangGraph
      </footer>
    </div>
  );
}

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, Sparkles, Globe2, RefreshCw, Copy } from 'lucide-react';
import { API_BASE } from '../constants/pipeline';

/**
 * Right column: Final localized post output with hook, markdown body,
 * image preview, and refine/copy actions.
 */
export default function FinalPostPanel({ result, loading, language, onRefine, onCopy, theme = 'dark' }) {
  const isDark = theme === 'dark';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="lg:col-span-4">
      <div className={`${isDark ? 'panel-glow-pink bg-[#0b0a36]/85 shadow-[0_0_34px_rgba(139,92,246,0.24)] border-violet-300/45 backdrop-blur-sm' : 'bg-white shadow-sm border-slate-200/70'} rounded-2xl border overflow-hidden h-full flex flex-col`}>
        <div className={`px-5 py-4 border-b flex justify-between items-center ${isDark ? 'border-violet-300/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/15' : 'border-slate-200 bg-slate-50'}`}>
          <h2 className={`font-semibold text-sm flex items-center gap-2 ${isDark ? 'text-emerald-200' : 'text-emerald-700'}`}>
            <CheckCircle className="w-4 h-4" />
            Final Localized Post
          </h2>
          {result && (
            <div className="flex gap-1.5">
              <button
                onClick={onRefine}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 border disabled:opacity-50 ${
                  isDark
                    ? 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 border-indigo-300/35 shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refine
              </button>
              <button
                onClick={handleCopy}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 border ${
                  isDark
                    ? 'bg-slate-800/90 hover:bg-slate-700 text-indigo-100 border-indigo-300/25'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        <div className={`p-5 flex-grow flex flex-col ${isDark ? 'bg-[radial-gradient(circle_at_20%_10%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(217,70,239,0.12),transparent_45%)]' : 'bg-white'}`}>
          {result ? (
            <>
              {/* Generated Image */}
              <div className="relative rounded-xl overflow-hidden border border-violet-300/35 mb-4 shadow-[0_0_22px_rgba(139,92,246,0.25)]">
                <img
                  src={result.image_url?.startsWith('/') ? `${API_BASE}${result.image_url}` : result.image_url}
                  alt="AI Generated Visual"
                  className="w-full h-48 object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-[10px] text-white/80 line-clamp-1">{result.image_prompt}</p>
                </div>
              </div>

              {/* Post Content */}
              <div className={`flex-grow rounded-xl border p-4 overflow-y-auto max-h-[400px] ${isDark ? 'bg-gradient-to-b from-slate-950/85 to-indigo-950/35 border-violet-300/30 shadow-[inset_0_0_16px_rgba(139,92,246,0.15)]' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-indigo-300/20">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">AI</div>
                  <div>
                    <p className={`text-xs font-semibold ${isDark ? 'text-indigo-100' : 'text-slate-800'}`}>Hybrid OS Content Engine</p>
                    <p className={`text-[10px] ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>Generated in {language}</p>
                  </div>
                </div>
                {result.hook && (
                  <div className="mb-3 pb-3 border-b border-indigo-300/20">
                    <p className={`text-base font-bold leading-snug ${isDark ? 'text-indigo-50' : 'text-slate-900'}`}>{result.hook}</p>
                  </div>
                )}
                <div className={`text-sm leading-relaxed max-w-none ${isDark ? 'text-indigo-100/90 prose prose-sm prose-invert' : 'text-slate-700 prose prose-sm'}
                  prose-strong:text-white prose-strong:font-semibold
                  prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                  prose-headings:text-indigo-50 prose-headings:mt-3 prose-headings:mb-1
                  prose-a:text-indigo-300 prose-a:no-underline hover:prose-a:underline`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.hook && result.final_post
                      ? result.final_post
                          .replace(result.hook, '')          // plain-text duplicate
                          .replace(`**${result.hook}**`, '') // bold markdown duplicate
                          .replace(/^\s*\n/, '')             // leftover leading blank line
                      : result.final_post}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Language Badge */}
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs px-3 py-1.5 rounded-lg font-medium border ${isDark ? 'bg-indigo-500/15 text-indigo-100 border-indigo-300/35 shadow-[0_0_10px_rgba(99,102,241,0.25)]' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                  <Globe2 className="w-3 h-3 inline mr-1" />
                  {language}
                </span>
                <span className={`text-[11px] ${isDark ? 'text-indigo-100/60' : 'text-slate-500'}`}>
                  {result.final_post?.length || 0} characters
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-indigo-100/40 gap-3 py-12">
              <Sparkles className="w-12 h-12" />
              <p className="text-sm font-medium">Final post will appear here</p>
              <p className="text-xs text-indigo-100/35">Enter a topic and click Orchestrate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
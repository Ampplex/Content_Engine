import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CheckCircle, Sparkles, Globe2, RefreshCw, Copy } from 'lucide-react';
import { API_BASE } from '../constants/pipeline';

export default function FinalPostPanel({ result, loading, language, onRefine, onCopy }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scorePct = typeof result?.scores?.final === 'number' ? `${(result.scores.final * 100).toFixed(1)}%` : 'N/A';
  const iterations = result?.iterations || 1;

  return (
    <div className="lg:col-span-4">
      <div className="ui-card overflow-hidden h-full flex flex-col">
        <div className="ui-card-header flex justify-between items-center">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-4 h-4" />
            Final Localized Post
          </h2>
          {result && (
            <div className="flex gap-1.5">
              <button
                onClick={onRefine}
                disabled={loading}
                className="ui-btn-secondary border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refine Draft
              </button>
              <button onClick={handleCopy} className="ui-btn-secondary">
                <Copy className="w-3 h-3" />
                {copied ? 'Copied!' : 'Copy Post'}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 flex-grow flex flex-col">
          {result ? (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-500">Quality score</p>
                  <p className="text-xs font-bold text-slate-800">{scorePct}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-500">Iterations</p>
                  <p className="text-xs font-bold text-slate-800">{iterations}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] text-slate-500">Language</p>
                  <p className="text-xs font-bold text-slate-800">{language}</p>
                </div>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-100 mb-4">
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

              <div className="flex-grow bg-slate-50 rounded-xl border border-slate-100 p-4 overflow-y-auto max-h-[400px]">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">AI</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Hybrid OS Content Engine</p>
                    <p className="text-[10px] text-slate-400">Generated in {language}</p>
                  </div>
                </div>
                {result.hook && (
                  <div className="mb-3 pb-3 border-b border-slate-100">
                    <p className="text-base font-bold text-slate-900 leading-snug">{result.hook}</p>
                  </div>
                )}
                <div className="text-sm text-slate-700 leading-relaxed prose prose-sm prose-slate max-w-none prose-strong:text-slate-900 prose-strong:font-semibold prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-slate-800 prose-headings:mt-3 prose-headings:mb-1 prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.hook && result.final_post
                      ? result.final_post.replace(result.hook, '').replace(`**${result.hook}**`, '').replace(/^\s*\n/, '')
                      : result.final_post}
                  </ReactMarkdown>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium border border-indigo-100">
                  <Globe2 className="w-3 h-3 inline mr-1" />
                  {language}
                </span>
                <span className="text-[11px] text-slate-400">{result.final_post?.length || 0} characters</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-3 py-12">
              <Sparkles className="w-12 h-12" />
              <p className="text-sm font-medium">Final post will appear here</p>
              <p className="text-xs text-slate-300">Enter a topic and click Generate Post</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

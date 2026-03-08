import React, { useState } from 'react';
import { CheckCircle, Sparkles, RefreshCw, Copy, Hash, Film, Layers, Globe2 } from 'lucide-react';
import { IG_API_BASE, IG_FORMAT_COLORS } from '../constants/ig_pipeline';

export default function IGOutputPanel({ result, loading, language, hashtags, onRefine, onCopy }) {
  const [copied, setCopied] = useState(false);
  const [subTab, setSubTab] = useState('caption');

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const format = result?.format || '';
  const hasReel = result?.reel_script && Object.keys(result.reel_script).length > 0;
  const hasCarousel = result?.carousel?.slides?.length > 0;
  const allHashtags = hashtags?.all || result?.hashtags?.all || [];
  const scorePct = typeof result?.scores?.final === 'number' ? `${(result.scores.final * 100).toFixed(1)}%` : 'N/A';
  const iterations = result?.iterations || 1;

  return (
    <div className="lg:col-span-4">
      <div className="ui-card overflow-hidden h-full flex flex-col">
        <div className="ui-card-header flex justify-between items-center">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-emerald-700">
            <CheckCircle className="w-4 h-4" /> Final Content
            {format && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${IG_FORMAT_COLORS[format] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {format}
              </span>
            )}
          </h2>

          {result && (
            <div className="flex gap-1.5">
              <button
                onClick={onRefine}
                disabled={loading}
                className="ui-btn-secondary border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refine Draft
              </button>
              <button onClick={handleCopy} className="ui-btn-secondary">
                <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy Caption'}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 flex-grow flex flex-col overflow-hidden">
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
                  <p className="text-[10px] text-slate-500">Hashtags</p>
                  <p className="text-xs font-bold text-slate-800">{allHashtags.length}</p>
                </div>
              </div>

              {result.image_url && (
                <div className="relative rounded-xl overflow-hidden border border-slate-100 mb-4 flex-shrink-0">
                  <img
                    src={result.image_url?.startsWith('/') ? `${IG_API_BASE}${result.image_url}` : result.image_url}
                    alt="Generated visual"
                    className="w-full h-44 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                    <p className="text-[10px] text-white/80 line-clamp-1">{result.image_prompt}</p>
                  </div>
                </div>
              )}

              {(hasReel || hasCarousel) && (
                <div className="flex gap-1.5 mb-4 flex-shrink-0">
                  {[
                    { id: 'caption', label: 'Caption', icon: Globe2 },
                    hasReel ? { id: 'reel', label: 'Reel Script', icon: Film } : null,
                    hasCarousel ? { id: 'carousel', label: 'Carousel Slides', icon: Layers } : null,
                  ].filter(Boolean).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSubTab(t.id)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                        subTab === t.id
                          ? 'bg-pink-500 text-white border-pink-500 shadow-sm shadow-pink-200/40'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-pink-50 hover:border-pink-300'
                      }`}
                    >
                      <t.icon className="w-3 h-3" />{t.label}
                    </button>
                  ))}
                </div>
              )}

              {subTab === 'caption' && (
                <div className="flex-grow overflow-y-auto min-h-0 space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white text-[10px] font-black">IG</div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">your.handle</p>
                      <p className="text-[10px] text-slate-400">Generated | {language}</p>
                    </div>
                  </div>

                  {result.hook && (
                    <div className="bg-pink-50 rounded-xl p-3.5 border border-pink-100">
                      <p className="text-[10px] font-bold text-pink-600 mb-1">HOOK (first frame)</p>
                      <p className="text-sm font-black text-slate-900 leading-snug">{result.hook}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Caption</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{result.caption}</p>
                  </div>

                  {result.ab_captions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">A/B variants</p>
                      <div className="space-y-2">
                        {result.ab_captions.map((v, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-500 mb-1">{v.label}</p>
                            <p className="text-xs text-slate-700 leading-relaxed">{v.caption}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allHashtags.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Hashtags ({allHashtags.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allHashtags.map((tag, i) => (
                          <span key={i} className="text-[10px] bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-2 py-0.5 rounded font-semibold">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {subTab === 'reel' && hasReel && (
                <div className="flex-grow overflow-y-auto min-h-0 space-y-3">
                  <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
                    <p className="text-[10px] font-bold text-pink-600 mb-1">HOOK FRAME (0-3 sec)</p>
                    <p className="text-sm font-black text-slate-900">{result.reel_script.hook_text}</p>
                    <p className="text-xs text-slate-500 mt-1">{result.reel_script.hook_frame}</p>
                  </div>

                  {(result.reel_script.segments || []).map((seg, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{seg.timestamp}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          seg.energy === 'High'
                            ? 'bg-red-100 text-red-600'
                            : seg.energy === 'Medium'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-green-100 text-green-600'
                        }`}>{seg.energy}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mb-1">Voiceover: {seg.voiceover}</p>
                      <p className="text-xs text-pink-600 font-bold mb-1">On-screen: {seg.on_screen}</p>
                      <p className="text-[11px] text-slate-400">B-roll: {seg.broll}</p>
                    </div>
                  ))}

                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                    <p className="text-[10px] font-bold text-emerald-600 mb-1">CTA</p>
                    <p className="text-sm font-bold text-slate-800">{result.reel_script.cta}</p>
                  </div>
                  {result.reel_script.music_vibe && (
                    <p className="text-xs text-slate-400 text-center pb-2">Music vibe: {result.reel_script.music_vibe}</p>
                  )}
                </div>
              )}

              {subTab === 'carousel' && hasCarousel && (
                <div className="flex-grow overflow-y-auto min-h-0 space-y-2">
                  {result.carousel.save_hook && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-2">
                      <p className="text-[10px] font-bold text-purple-600 mb-1">WHY SAVE THIS</p>
                      <p className="text-xs text-slate-700">{result.carousel.save_hook}</p>
                    </div>
                  )}
                  {(result.carousel.slides || []).map((slide, i) => (
                    <div
                      key={i}
                      className={`rounded-xl p-3.5 border ${
                        slide.is_hook
                          ? 'bg-pink-50 border-pink-200'
                          : slide.is_cta
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          slide.is_hook
                            ? 'bg-pink-200 text-pink-700'
                            : slide.is_cta
                              ? 'bg-emerald-200 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          Slide {slide.slide_number}{slide.is_hook ? ' | Cover' : slide.is_cta ? ' | CTA' : ''}
                        </span>
                        <span className="text-base">{slide.emoji}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900 mb-1">{slide.headline}</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{slide.body}</p>
                      {slide.visual_note && <p className="text-[10px] text-slate-400 mt-1.5 italic">{slide.visual_note}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between flex-shrink-0 pt-2 border-t border-slate-100">
                <span className="text-xs bg-pink-50 text-pink-600 px-3 py-1 rounded-lg font-medium border border-pink-100 flex items-center gap-1">
                  <Globe2 className="w-3 h-3" />{language}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">{result.caption?.length || 0} chars</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-200 gap-3 py-16">
              <Sparkles className="w-12 h-12" />
              <p className="text-sm font-medium text-slate-300">Caption, reel script, and carousel output appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

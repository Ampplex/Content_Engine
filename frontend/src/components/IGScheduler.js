import React, { useState } from 'react';
import {
  Calendar, Clock, Loader2, Zap, Star, ChevronDown, AlertCircle,
} from 'lucide-react';
import { IG_API_BASE, IG_FORMATS, IG_TONES, IG_AUDIENCES } from '../constants/ig_pipeline';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CONFIDENCE_STYLE = {
  '🔥 Prime':   'bg-orange-50 border-orange-200 text-orange-700',
  '✅ Great':   'bg-emerald-50 border-emerald-200 text-emerald-700',
  '👍 Good':    'bg-blue-50 border-blue-200 text-blue-700',
  '⚠️ Average': 'bg-amber-50 border-amber-200 text-amber-600',
};

function SelectField({ label, value, onChange, options, isDark }) {
  return (
    <div>
      <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{label}</label>
      <div className="relative">
        <select
          value={value} onChange={e => onChange(e.target.value)}
          className={`w-full appearance-none border rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-pink-400/30 focus:border-pink-400 pr-8 transition ${
            isDark
              ? 'bg-slate-900/70 border-slate-600 text-slate-100'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          {options.map(o => (
            <option key={o} className="text-slate-900 bg-white">{o}</option>
          ))}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDark ? 'text-slate-300' : 'text-slate-400'}`} />
      </div>
    </div>
  );
}

export default function IGScheduler({ theme = 'light' }) {
  const isDark = theme === 'dark';
  const [fmt,      setFmt]      = useState('Reel');
  const [tone,     setTone]     = useState('Educational');
  const [audience, setAudience] = useState('Gen Z');
  const [ppw,      setPpw]      = useState(5);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [schedule, setSchedule] = useState(null);
  const [slots,    setSlots]    = useState(null);
  const [view,     setView]     = useState('weekly');

  const fetch_ = async () => {
    setLoading(true); setError('');
    try {
      const [schR, slotR] = await Promise.all([
        fetch(`${IG_API_BASE}/api/ig/schedule`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ format: fmt, tone, audience, posts_per_week: ppw }),
        }),
        fetch(`${IG_API_BASE}/api/ig/schedule/best-slots?format=${fmt}&tone=${tone}&audience=${audience}&top_n=10`),
      ]);
      const schData  = await schR.json();
      const slotData = await slotR.json();
      if (schData.error) setError(schData.error);
      else { setSchedule(schData); setSlots(slotData?.slots || []); }
    } catch { setError('Instagram API unreachable (check backend/main.py on 8000).'); }
    setLoading(false);
  };

  const scheduledDays = new Set((schedule?.schedule || []).map(s => s.day));

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className={`${isDark ? 'bg-[#0b0a2f]/80 text-slate-100 border-pink-300/30 shadow-[0_0_24px_rgba(236,72,153,0.18)]' : 'bg-white text-slate-900 border-slate-200 shadow-md'} rounded-2xl p-7 border`}>
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black">Instagram Scheduler</h2>
              <p className={`${isDark ? 'text-slate-300' : 'text-slate-500'} text-sm mt-0.5`}>LightGBM model · IST timezone · Indian audience</p>
            </div>
          </div>
          {schedule && (
            <div className={`${isDark ? 'bg-pink-500/15 border-pink-300/30' : 'bg-pink-50 border-pink-100'} rounded-xl px-4 py-2.5 text-right border`}>
              <p className={`${isDark ? 'text-pink-200' : 'text-pink-600'} text-xs`}>Best slot</p>
              <p className="text-lg font-black">{schedule.best_day}</p>
              <p className={`${isDark ? 'text-pink-100' : 'text-pink-700'} text-sm font-semibold`}>{schedule.best_time}</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`${isDark ? 'bg-[#0b0a2f]/80 border-pink-300/30 shadow-[0_0_20px_rgba(236,72,153,0.14)]' : 'bg-white border-slate-200 shadow-md'} border rounded-2xl p-5`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
          <SelectField label="Format"   value={fmt}      onChange={setFmt}      options={IG_FORMATS} isDark={isDark} />
          <SelectField label="Tone"     value={tone}     onChange={setTone}     options={IG_TONES} isDark={isDark} />
          <SelectField label="Audience" value={audience} onChange={setAudience} options={IG_AUDIENCES} isDark={isDark} />
          <button
            onClick={fetch_} disabled={loading}
            className="bg-pink-600 hover:bg-pink-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Computing…' : 'Get Schedule'}
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap">Posts/week:</label>
          {[3, 4, 5, 6, 7].map(n => (
            <button key={n} onClick={() => setPpw(n)}
              className={`w-9 h-9 rounded-lg font-bold text-sm transition ${ppw === n ? 'bg-pink-500 text-white shadow-sm shadow-pink-200' : 'bg-slate-100 text-slate-600 hover:bg-pink-50'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className={`${isDark ? 'bg-red-500/10 border-red-300/30 text-red-200' : 'bg-red-50 border-red-200 text-red-600'} border rounded-xl px-4 py-3 flex items-center gap-2 text-sm`}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {schedule && !loading && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Best Day',    val: schedule.best_day,   icon: Calendar, color: 'text-pink-600 bg-pink-50' },
              { label: 'Best Time',   val: schedule.best_time,  icon: Clock,    color: 'text-rose-600 bg-rose-50' },
              { label: 'Avg Score',   val: `${schedule.avg_predicted_engagement?.toFixed(1)}%`, icon: Star, color: 'text-amber-600 bg-amber-50' },
              { label: 'Posts / Week',val: `${schedule.posts_per_week}`, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
            ].map(s => (
              <div key={s.label} className={`${isDark ? 'bg-[#0b0a2f]/80 border-pink-300/20 shadow-[0_0_16px_rgba(236,72,153,0.14)]' : 'bg-white border-slate-200 shadow-md'} border rounded-2xl p-4 text-center`}>
                <div className={`w-8 h-8 rounded-xl ${s.color} flex items-center justify-center mx-auto mb-2`}>
                  <s.icon className="w-4 h-4" />
                </div>
                <p className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{s.val}</p>
                <p className={`text-[11px] mt-0.5 font-medium ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-2">
            {[
              { id: 'weekly', label: '📅 Weekly Plan' },
              { id: 'slots',  label: '🏆 Best Slots' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-5 py-2 rounded-xl text-sm font-bold border transition-all ${
                  view === v.id
                    ? 'bg-pink-500 text-white border-pink-500 shadow-md shadow-pink-200/40'
                    : isDark
                      ? 'bg-[#0b0a2f]/80 text-slate-300 border-pink-300/20 hover:border-pink-300/40 hover:bg-pink-500/10'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300 hover:bg-pink-50'
                }`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Weekly calendar */}
          {view === 'weekly' && (
            <div className={`${isDark ? 'bg-[#0b0a2f]/80 border-pink-300/20 shadow-[0_0_18px_rgba(236,72,153,0.12)]' : 'bg-white border-slate-200 shadow-md'} border rounded-2xl overflow-hidden`}>
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Optimal {fmt} Posting Schedule</h3>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-7 gap-2">
                  {DAYS.map((day, i) => {
                    const slot   = schedule.schedule.find(s => s.day === i);
                    const isSched = scheduledDays.has(i);
                    return (
                      <div key={day} className={`rounded-2xl p-3 text-center border-2 transition-all ${
                        isSched
                          ? 'border-pink-400 bg-gradient-to-b from-pink-50 to-rose-50 shadow-md shadow-pink-100'
                          : 'border-slate-100 bg-slate-50/50 opacity-40'
                      }`}>
                        <p className={`text-xs font-bold mb-1 ${isSched ? 'text-pink-700' : 'text-slate-400'}`}>{day}</p>
                        {isSched && slot ? (
                          <>
                            <div className="flex items-center justify-center gap-0.5 mt-1">
                              <Clock className="w-2.5 h-2.5 text-pink-400" />
                              <p className="text-xs font-black text-slate-800">{slot.time_ist}</p>
                            </div>
                            <p className="text-lg font-black text-pink-600 mt-0.5">{slot.predicted_engagement?.toFixed(1)}%</p>
                            <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border mt-1 ${CONFIDENCE_STYLE[slot.confidence_label] || 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                              {slot.confidence_label}
                            </div>
                          </>
                        ) : <p className="text-[10px] text-slate-300 mt-2">–</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {schedule.insights?.length > 0 && (
                <div className="px-5 pb-5 space-y-2">
                  {schedule.insights.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-pink-50/70 border border-pink-200/60 rounded-xl px-4 py-3">
                      <Star className="w-3.5 h-3.5 text-pink-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-slate-700">{tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Best slots ranked list */}
          {view === 'slots' && slots?.length > 0 && (
            <div className={`${isDark ? 'bg-[#0b0a2f]/80 border-pink-300/20 shadow-[0_0_18px_rgba(236,72,153,0.12)]' : 'bg-white border-slate-200 shadow-md'} border rounded-2xl overflow-hidden`}>
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className={`font-semibold text-sm ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Top 10 Posting Slots</h3>
              </div>
              <div className="p-4 space-y-2">
                {slots.map((slot, i) => (
                  <div key={i} className={`flex items-center gap-4 border rounded-xl px-4 py-3 transition ${isDark ? 'bg-slate-900/50 hover:bg-pink-500/10 border-pink-300/15 hover:border-pink-300/35' : 'bg-slate-50 hover:bg-pink-50/40 border-slate-100 hover:border-pink-200'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      i === 0 ? 'bg-pink-500 text-white shadow-sm shadow-pink-200'
                      : i < 3  ? 'bg-pink-100 text-pink-600'
                      : 'bg-slate-200 text-slate-500'
                    }`}>{i + 1}</div>
                    <div className="w-24 flex-shrink-0">
                      <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{slot.day_name}</p>
                      <p className={`text-xs font-mono ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>{slot.time_ist}</p>
                    </div>
                    <div className="flex-grow">
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400 transition-all duration-700"
                          style={{ width: `${(slot.predicted_engagement / 10) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 w-20">
                      <p className="text-base font-black text-pink-600">{slot.predicted_engagement?.toFixed(1)}%</p>
                      <p className="text-[10px] text-slate-400">{slot.confidence_label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!schedule && !loading && (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-16 text-center">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">Select your format + audience and get your optimal Instagram schedule</p>
        </div>
      )}
    </div>
  );
}

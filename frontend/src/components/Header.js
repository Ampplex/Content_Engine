import React from 'react';
import { Activity, BrainCircuit, LineChart, Instagram, TrendingUp, Calendar, Crosshair } from 'lucide-react';

const LI_TABS = [
  { id: 'generator', label: 'Content Engine', icon: BrainCircuit },
  { id: 'copilot',   label: 'Growth Copilot', icon: LineChart },
];

const IG_TABS = [
  { id: 'ig_generator',  label: 'Content Engine', icon: BrainCircuit },
  { id: 'ig_copilot',    label: 'Growth Copilot', icon: TrendingUp },
  { id: 'ig_scheduler',  label: 'Scheduler',      icon: Calendar },
  { id: 'ig_competitor', label: 'Niche Intel',    icon: Crosshair },
];

export default function Header({ tab, onTabChange, platform, onPlatformChange }) {
  const isIG   = platform === 'instagram';
  const tabs   = isIG ? IG_TABS : LI_TABS;
  const accent = isIG ? 'bg-pink-600' : 'bg-indigo-600';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex justify-between items-center gap-4">

        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center`}>
            {isIG
              ? <Instagram className="text-white w-5 h-5" />
              : <Activity   className="text-white w-5 h-5" />}
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">
              {isIG ? 'Instagram Engine' : 'Content Engine'}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5">
              {isIG ? 'AI for Indian Creators' : 'AI for Bharat · LinkedIn'}
            </p>
          </div>
        </div>

        {/* Platform toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => onPlatformChange('linkedin')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                !isIG
                  ? 'bg-white shadow-sm text-indigo-700 border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> LinkedIn
            </button>
            <button
              onClick={() => onPlatformChange('instagram')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                isIG
                  ? 'bg-white shadow-sm text-pink-600 border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
          {tabs.map((t) => {
            const Icon     = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? `bg-white border border-slate-200 ${isIG ? 'text-pink-700' : 'text-indigo-700'}`
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Status badge */}
        <div className="flex-shrink-0">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium border whitespace-nowrap ${
            isIG
              ? 'bg-pink-50 text-pink-700 border-pink-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${isIG ? 'bg-pink-500' : 'bg-emerald-500'}`} />
            {isIG ? 'API: 8000/instagram' : 'Bedrock Connected'}
          </span>
        </div>

      </div>
    </header>
  );
}

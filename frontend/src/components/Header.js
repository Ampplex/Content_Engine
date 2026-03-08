import React from 'react';
import { Linkedin, BrainCircuit, LineChart, Instagram, TrendingUp, Calendar, Crosshair } from 'lucide-react';

const LI_TABS = [
  { id: 'generator', label: 'LinkedIn Engine', icon: BrainCircuit },
  { id: 'copilot', label: 'Growth Copilot', icon: LineChart },
];

const IG_TABS = [
  { id: 'ig_generator', label: 'Content Engine', icon: BrainCircuit },
  { id: 'ig_copilot', label: 'Growth Copilot', icon: TrendingUp },
  { id: 'ig_scheduler', label: 'Scheduler', icon: Calendar },
  { id: 'ig_competitor', label: 'Niche Intel', icon: Crosshair },
];

export default function Header({ tab, onTabChange, platform, onPlatformChange }) {
  const isIG = platform === 'instagram';
  const tabs = isIG ? IG_TABS : LI_TABS;
  const accent = isIG ? 'bg-pink-600' : 'bg-indigo-600';

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>
            {isIG ? <Instagram className="text-white w-5 h-5" /> : <Linkedin className="text-white w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight leading-tight truncate">
              {isIG ? 'Instagram Engine' : 'LinkedIn Engine'}
            </h1>
            <p className="text-[10px] text-slate-400 font-medium -mt-0.5 truncate">
              {isIG ? 'AI for Indian Creators' : 'AI for Bharat | LinkedIn'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button
              onClick={() => onPlatformChange('linkedin')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                !isIG
                  ? 'bg-white shadow-sm text-indigo-700 border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Linkedin className="w-3.5 h-3.5" /> LinkedIn
            </button>
            <button
              onClick={() => onPlatformChange('instagram')}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2 ${
                isIG
                  ? 'bg-white shadow-sm text-pink-600 border border-slate-200/60'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </button>
          </div>
        </div>

        <div className="w-full order-last">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 ${
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
        </div>

        <div className="hidden xl:block ml-auto">
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium border whitespace-nowrap ${
            isIG
              ? 'bg-pink-50 text-pink-700 border-pink-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${isIG ? 'bg-pink-500' : 'bg-emerald-500'}`} />
            {isIG ? 'Instagram API mounted' : 'Bedrock connected'}
          </span>
        </div>
      </div>
    </header>
  );
}

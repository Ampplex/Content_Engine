import React from 'react';
import {
  Activity,
  BrainCircuit,
  LineChart,
  Instagram,
  TrendingUp,
  Calendar,
  Crosshair,
  Moon,
  Sun,
} from 'lucide-react';

const LI_TABS = [
  { id: 'generator', label: 'Content Engine', icon: BrainCircuit },
  { id: 'copilot', label: 'Growth Copilot', icon: LineChart },
];

const IG_TABS = [
  { id: 'ig_generator', label: 'Content Engine', icon: BrainCircuit },
  { id: 'ig_copilot', label: 'Growth Copilot', icon: TrendingUp },
  { id: 'ig_scheduler', label: 'Scheduler', icon: Calendar },
  { id: 'ig_competitor', label: 'Niche Intel', icon: Crosshair },
];

export default function Header({
  tab,
  onTabChange,
  platform,
  onPlatformChange,
  theme = 'dark',
  onToggleTheme,
}) {
  const isIG = platform === 'instagram';
  const isDark = theme === 'dark';
  const tabs = isIG ? IG_TABS : LI_TABS;

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl ${
        isDark
          ? 'bg-slate-950/75 border-indigo-400/20'
          : 'bg-white/90 border-slate-200'
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isIG
                ? 'bg-gradient-to-br from-pink-500 to-rose-500'
                : isDark
                ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500'
                : 'bg-indigo-600'
            }`}
          >
            {isIG ? (
              <Instagram className="w-5 h-5 text-white" />
            ) : (
              <Activity className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h1 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isIG ? 'Instagram Engine' : 'Content Engine'}
            </h1>
            <p className={`text-[10px] font-medium ${isDark ? 'text-indigo-100/70' : 'text-slate-500'}`}>
              {isIG ? 'AI for Indian Creators' : 'AI-Powered Marketing Content'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`flex p-1 rounded-xl border ${
              isDark ? 'bg-slate-900/70 border-indigo-300/30' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              onClick={() => onPlatformChange('linkedin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                !isIG
                  ? isDark
                    ? 'bg-indigo-500/25 text-indigo-100 border border-indigo-300/40'
                    : 'bg-white text-indigo-700 border border-slate-200'
                  : isDark
                  ? 'text-indigo-100/70 hover:text-indigo-100'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> LinkedIn
            </button>
            <button
              onClick={() => onPlatformChange('instagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                isIG
                  ? isDark
                    ? 'bg-pink-500/25 text-pink-100 border border-pink-300/40'
                    : 'bg-white text-pink-700 border border-slate-200'
                  : isDark
                  ? 'text-indigo-100/70 hover:text-indigo-100'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Instagram className="w-3.5 h-3.5" /> Instagram
            </button>
          </div>

          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border ${
              isDark
                ? 'bg-slate-900/70 border-indigo-300/30 text-indigo-100'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div
          className={`flex p-1 rounded-xl border ${
            isDark ? 'bg-slate-900/70 border-indigo-300/30' : 'bg-slate-100 border-slate-200'
          }`}
        >
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  active
                    ? isDark
                      ? 'bg-indigo-500/25 border border-indigo-300/40 text-indigo-100'
                      : 'bg-white border border-slate-200 text-indigo-700'
                    : isDark
                    ? 'text-indigo-100/70 hover:text-indigo-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

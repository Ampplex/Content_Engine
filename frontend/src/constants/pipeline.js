import { Sparkles, Search, Zap, Globe2, Shield, AlertTriangle, BarChart3, Eye } from 'lucide-react';
export { API_BASE } from './api';

export const PIPELINE_STEPS = [
  { id: 'drafting',      label: 'Content Drafter',       icon: Sparkles,      desc: 'Generating concise English draft...' },
  { id: 'trend_search',  label: 'Trend & Fact-Check',    icon: Search,        desc: 'Searching web for trends & verifying facts...' },
  { id: 'hook',          label: 'Hook Generator',        icon: Zap,           desc: 'Crafting scroll-stopping opening hook...' },
  { id: 'localization',  label: 'Indic Localizer',       icon: Globe2,        desc: 'Translating & culturally adapting...' },
  { id: 'seo',           label: 'SEO Optimizer',         icon: Search,        desc: 'Analyzing hashtags & keywords...' },
  { id: 'brand',         label: 'Brand Guardian',        icon: Shield,        desc: 'Reviewing tone & professionalism...' },
  { id: 'ethics',        label: 'Ethics & Safety Agent', icon: AlertTriangle, desc: 'Checking bias & compliance...' },
  { id: 'scoring',       label: 'Hybrid Scoring Engine', icon: BarChart3,     desc: 'Computing engagement prediction...' },
  { id: 'visuals',       label: 'Visual Strategist',     icon: Eye,           desc: 'Crafting image generation prompt...' },
];

export const LANGUAGES = ['Hindi', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Kannada', 'English'];

export const TONE_COLORS = {
  'Educational': 'bg-blue-100 text-blue-700 border-blue-200',
  'Promotional': 'bg-red-100 text-red-700 border-red-200',
  'Story':       'bg-purple-100 text-purple-700 border-purple-200',
  'Opinion':     'bg-amber-100 text-amber-700 border-amber-200',
};

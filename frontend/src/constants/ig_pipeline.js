import { Crosshair, Sliders, Search, Edit3, Zap, Hash, Film, BarChart3, Eye } from 'lucide-react';
export { IG_API_BASE } from './api';

export const IG_PIPELINE_STEPS = [
  { id: 'competitor_analysis', label: 'Competitor Intel',    icon: Crosshair, desc: 'Analyzing top content in your niche...' },
  { id: 'format_selector',     label: 'Format Selector',    icon: Sliders,   desc: 'Choosing best format for your topic...' },
  { id: 'trend_search',        label: 'Trend Research',     icon: Search,    desc: 'Searching viral content & trends...' },
  { id: 'caption_drafter',     label: 'Caption Drafter',    icon: Edit3,     desc: 'Writing scroll-stopping caption...' },
  { id: 'hook_gen',            label: 'Hook Generator',     icon: Zap,       desc: 'Crafting viral opening hook...' },
  { id: 'hashtag_gen',         label: 'Hashtag Engine',     icon: Hash,      desc: 'Building optimal hashtag set (20-30)...' },
  { id: 'critique',            label: 'Virality Critique',  icon: Film,      desc: 'Virality + Brand + Ethics review...' },
  { id: 'scoring',             label: 'Engagement Scorer',  icon: BarChart3, desc: 'LightGBM engagement prediction...' },
  { id: 'visuals',             label: 'Visual Director',    icon: Eye,       desc: 'Creating format-specific visual...' },
];

export const IG_FORMATS   = ['Reel', 'Carousel', 'Static', 'Story'];
export const IG_TONES     = ['Educational', 'Motivational', 'Funny', 'Emotional', 'Promotional'];
export const IG_AUDIENCES = ['Gen Z', 'Millennial', 'Professional', 'Student', 'Creator'];
export const IG_LANGUAGES = ['English', 'Hindi', 'Hinglish', 'Tamil', 'Telugu', 'Bengali', 'Marathi'];

export const IG_REEL_DURATIONS = [15, 30, 60];

export const IG_FORMAT_COLORS = {
  'Reel':      'bg-pink-100 text-pink-700 border-pink-200',
  'Carousel':  'bg-purple-100 text-purple-700 border-purple-200',
  'Static':    'bg-blue-100 text-blue-700 border-blue-200',
  'Story':     'bg-orange-100 text-orange-700 border-orange-200',
};

export const IG_TONE_COLORS = {
  'Educational':  'bg-blue-100 text-blue-700 border-blue-200',
  'Motivational': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Funny':        'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Emotional':    'bg-rose-100 text-rose-700 border-rose-200',
  'Promotional':  'bg-red-100 text-red-700 border-red-200',
};

export const IG_CAROUSEL_STRUCTURES = [
  'Educational', 'Listicle', 'Story', 'Tutorial', 'Comparison',
];

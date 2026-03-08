import React, { useState, useEffect } from 'react';
import { Linkedin, User, TrendingUp, TrendingDown, RefreshCw, Loader2,
         BarChart2, Link2, ExternalLink, Award, MessageSquare, Heart, Share2 } from 'lucide-react';
import { API_BASE, TONE_COLORS } from '../constants/pipeline';

/**
 * LinkedIn Panel — OAuth connect flow + real engagement data dashboard.
 * Tabs: Connect → Profile → Real Data
 */
export default function LinkedInPanel() {
  const [accessToken, setAccessToken]   = useState(localStorage.getItem('li_token') || '');
  const [profile, setProfile]           = useState(null);
  const [realData, setRealData]         = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [activeInnerTab, setActiveInnerTab] = useState('connect');
  const [days, setDays]                 = useState(14);

  // ── Auto-fill token when OAuth popup posts back ────────────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'linkedin_token' && event.data.access_token) {
        setAccessToken(event.data.access_token);
        setError('');
        // Auto-trigger profile fetch
        setTimeout(() => fetchProfileWithToken(event.data.access_token), 300);
      }
      if (event.data?.type === 'linkedin_error') {
        setError(`LinkedIn error: ${event.data.message}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ── Step 1: Get auth URL and redirect ─────────────────────────────────
  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/linkedin/auth`);
      const data = await res.json();
      if (data.auth_url) {
        window.open(data.auth_url, '_blank', 'width=600,height=700');
      } else {
        setError('Could not get auth URL. Check LINKEDIN_CLIENT_ID in .env');
      }
    } catch (e) {
      setError('Backend unreachable. Is the server running on port 8000?');
    }
    setLoading(false);
  };

  // ── Fetch profile after pasting token ─────────────────────────────────
  const fetchProfileWithToken = async (token) => {
    if (!token?.trim()) { setError('Paste your access token first.'); return; }
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/linkedin/profile?access_token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else {
        setProfile(data);
        localStorage.setItem('li_token', token);
        setActiveInnerTab('data');
        await fetchData(token);
      }
    } catch (e) { setError('Failed to fetch profile.'); }
    setLoading(false);
  };

  const fetchProfile = () => fetchProfileWithToken(accessToken);

  // ── Fetch real engagement data ─────────────────────────────────────────
  const fetchData = async (token = accessToken) => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API_BASE}/api/linkedin/data?access_token=${encodeURIComponent(token)}&days=${days}`);
      const data = await res.json();
      if (data.error) setError(data.error);
      else setRealData(data);
    } catch (e) { setError('Failed to fetch engagement data.'); }
    setLoading(false);
  };

  const disconnect = () => {
    setAccessToken(''); setProfile(null); setRealData(null);
    localStorage.removeItem('li_token');
    setActiveInnerTab('connect');
  };

  const posts = realData?.posts || [];
  const avgEng = realData?.avg_engagement ?? 0;

  return (
    <div className="space-y-5">
      {/* ── Header Card ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0077B5] to-[#005885] text-white rounded-2xl p-7 relative overflow-hidden shadow-lg shadow-blue-200/40">
        <div className="absolute right-0 top-0 w-56 h-56 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute right-24 bottom-0 w-32 h-32 rounded-full bg-white/5 translate-y-1/2" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Linkedin className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">LinkedIn Integration</h2>
              <p className="text-blue-200 text-sm mt-0.5">Connect your account to pull real engagement data</p>
            </div>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              {profile.profile?.picture
                ? <img src={profile.profile.picture} alt="avatar" className="w-10 h-10 rounded-full border-2 border-white/30" />
                : <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><User className="w-5 h-5" /></div>
              }
              <div className="text-right">
                <p className="font-semibold text-sm">{profile.profile?.name}</p>
                <p className="text-blue-200 text-xs">{profile.profile?.email}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Inner Tab Bar ───────────────────────────────────────────── */}
      <div className="flex gap-2">
        {[
          { id: 'connect', label: 'Connect' },
          { id: 'data',    label: 'Engagement Data', disabled: !profile },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setActiveInnerTab(t.id)}
            disabled={t.disabled}
            className={`px-5 py-2 rounded-xl text-sm font-semibold border transition-all ${
              activeInnerTab === t.id
                ? 'bg-[#0077B5] text-white border-[#0077B5] shadow-md shadow-blue-200/40'
                : t.disabled
                  ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#0077B5] hover:text-[#0077B5]'
            }`}
          >{t.label}</button>
        ))}
        {profile && (
          <button onClick={disconnect}
            className="ml-auto px-4 py-2 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition">
            Disconnect
          </button>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {/* ═══ CONNECT TAB ════════════════════════════════════════════ */}
      {activeInnerTab === 'connect' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Step 1 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#0077B5] text-white flex items-center justify-center text-sm font-bold">1</div>
              <h3 className="font-semibold text-slate-800">Authorize LinkedIn</h3>
            </div>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              Click below to open LinkedIn's OAuth page. Log in and approve permissions.
              After approving, copy the <code className="bg-slate-100 px-1 rounded text-xs">access_token</code> from the callback URL.
            </p>
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full bg-[#0077B5] hover:bg-[#005885] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-blue-200/40 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
              Connect with LinkedIn
            </button>
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Opens LinkedIn OAuth in a new tab
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#0077B5] text-white flex items-center justify-center text-sm font-bold">2</div>
              <h3 className="font-semibold text-slate-800">Paste Access Token</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              After OAuth completes, paste the <code className="bg-slate-100 px-1 rounded text-xs">access_token</code> returned by the callback.
            </p>
            <textarea
              value={accessToken}
              onChange={e => setAccessToken(e.target.value)}
              placeholder="Paste access_token here..."
              rows={3}
              className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0077B5]/30 resize-none"
            />
            <button
              onClick={fetchProfile}
              disabled={loading || !accessToken.trim()}
              className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Verify & Load Data
            </button>
          </div>

          {/* Dev note */}
          <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700 font-semibold mb-1">⚠️ Development Mode</p>
            <p className="text-xs text-amber-600 leading-relaxed">
              In production, use sessions/Redis to store tokens server-side. The access_token is currently stored in localStorage for demo purposes only.
              Set <code className="bg-amber-100 px-1 rounded">LINKEDIN_CLIENT_ID</code>, <code className="bg-amber-100 px-1 rounded">LINKEDIN_CLIENT_SECRET</code>, and <code className="bg-amber-100 px-1 rounded">LINKEDIN_REDIRECT_URI</code> in your <code className="bg-amber-100 px-1 rounded">.env</code>.
            </p>
          </div>
        </div>
      )}

      {/* ═══ DATA TAB ═══════════════════════════════════════════════ */}
      {activeInnerTab === 'data' && (
        <div className="space-y-5">
          {/* Stats Row */}
          {profile && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Posts', value: profile.total_posts ?? posts.length, icon: BarChart2, color: 'text-blue-600 bg-blue-50' },
                { label: 'Avg Engagement', value: `${avgEng.toFixed(1)}%`, icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Best Tone', value: profile.best_tone || '—', icon: Award, color: 'text-purple-600 bg-purple-50' },
                { label: 'Days Analyzed', value: days, icon: RefreshCw, color: 'text-amber-600 bg-amber-50' },
              ].map(s => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <p className="text-2xl font-black text-slate-900">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-600 whitespace-nowrap">Days to analyze:</label>
            <input type="range" min="7" max="30" value={days} onChange={e => setDays(+e.target.value)}
              className="flex-grow accent-[#0077B5]" />
            <span className="text-sm font-bold text-[#0077B5] w-8">{days}</span>
            <button onClick={() => fetchData()}
              disabled={loading}
              className="bg-[#0077B5] hover:bg-[#005885] text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Refresh
            </button>
          </div>

          {/* Post Table */}
          {posts.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-sm text-slate-800">Real Post Engagement Data</h3>
                <p className="text-xs text-slate-400 mt-0.5">{posts.length} posts from LinkedIn API</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    <tr>
                      {['Date', 'Tone', 'Snippet', 'Likes', 'Comments', 'Shares', 'Eng. Rate'].map(h => (
                        <th key={h} className="px-4 py-3 text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {posts.map((p, i) => {
                      const rate = parseFloat(p.engagement_rate);
                      return (
                        <tr key={i} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">{p.date}</td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${TONE_COLORS[p.tone] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {p.tone}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate">{p.text_snippet || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-red-500"><Heart className="w-3 h-3" />{p.likes}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-blue-500"><MessageSquare className="w-3 h-3" />{p.comments}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-xs text-green-500"><Share2 className="w-3 h-3" />{p.shares}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${rate > 5 ? 'bg-emerald-500' : rate > 3 ? 'bg-blue-500' : 'bg-red-400'}`}
                                  style={{ width: `${Math.min(rate * 12.5, 100)}%` }} />
                              </div>
                              <span className={`text-xs font-bold ${rate > 5 ? 'text-emerald-600' : rate > 3 ? 'text-blue-600' : 'text-red-500'}`}>
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#0077B5]" />
              <span className="ml-3 text-sm text-slate-500">Fetching real LinkedIn data...</span>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No post data yet. Connect your LinkedIn account first.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, PhoneCall, MessageSquare, Heart, Trophy, Package, DollarSign,
  Briefcase, Shield, BookOpen, AlertTriangle, ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { communityApi, analyticsApi, incidentsApi } from '../services/api';
import { IncidentReportModal } from '../components/IncidentReportModal';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string; author_name: string; author_role: string; message: string;
  created_at: string; likes_count: number; liked: boolean;
}
interface LeaderDriver { id: string; name: string; avatar?: string; rating: number; deliveries_30d: number; revenue_30d: number; }
interface LeaderDispatcher { id: string; name: string; loads_30d: number; earned_30d: number; }

export default function DispatcherHub() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { dark } = useTheme();
  const isAdmin = user?.role === 'admin';
  const accent = isAdmin ? '#a855f7' : '#f97316';
  const accentSoft = isAdmin ? 'rgba(168,85,247,0.12)' : 'rgba(249,115,22,0.12)';

  const [section, setSection] = useState<'community' | 'leaderboard' | 'support'>('community');
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  // ── Community (real, shared with the driver app) ───────
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);

  const loadPosts = () => {
    communityApi.getPosts().then(r => setPosts(r.data)).catch(() => {}).finally(() => setPostsLoading(false));
  };
  useEffect(() => { loadPosts(); }, []);

  const publish = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const { data } = await communityApi.createPost(postText.trim());
      setPosts(prev => [data, ...prev]);
      setPostText('');
    } catch {
      alert(t('hub.postError'));
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes_count: p.liked ? p.likes_count - 1 : p.likes_count + 1 } : p));
    try { await communityApi.toggleLike(id); } catch { loadPosts(); }
  };

  // ── Leaderboard ──────────────────────────────────────────
  const [topDrivers, setTopDrivers] = useState<LeaderDriver[]>([]);
  const [topDispatchers, setTopDispatchers] = useState<LeaderDispatcher[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  useEffect(() => {
    if (section !== 'leaderboard') return;
    analyticsApi.getLeaderboard()
      .then(r => { setTopDrivers(r.data.topDrivers || []); setTopDispatchers(r.data.topDispatchers || []); })
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }, [section]);

  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'D';

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-4">

      {/* ── Section Tabs ─────────────────────────────────── */}
      <div className="flex gap-2">
        {([
          { id: 'community' as const,   icon: Users,   label: t('hub.tabCommunity') },
          { id: 'leaderboard' as const, icon: Trophy,  label: t('hub.tabTop') },
          { id: 'support' as const,     icon: PhoneCall, label: t('hub.tabSupport') },
        ]).map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={section === s.id ? {
              background: `linear-gradient(135deg, ${accent}, ${isAdmin ? '#7c3aed' : '#ea580c'})`,
              color: '#fff',
              boxShadow: `0 4px 14px ${isAdmin ? 'rgba(168,85,247,0.3)' : 'rgba(249,115,22,0.3)'}`,
            } : {
              background: dark ? 'rgba(51,65,85,0.5)' : '#f8fafc',
              color: dark ? '#94a3b8' : '#64748b',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
            }}>
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/*  COMUNIDAD                                        */}
      {/* ══════════════════════════════════════════════════ */}
      {section === 'community' && (
        <div className="space-y-3 fade-in">

          {/* Post composer */}
          <div className={`rounded-2xl p-4 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                   style={{ background: `linear-gradient(135deg, ${accent}, ${isAdmin ? '#7c3aed' : '#ea580c'})` }}>
                {initials}
              </div>
              <div className="flex-1">
                <textarea
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  placeholder={t('hub.composerPlaceholder')}
                  className={`w-full text-sm rounded-xl p-3 resize-none border-0 outline-none ${dark ? 'bg-slate-700 text-slate-200 placeholder:text-slate-500' : 'bg-gray-50 text-gray-800 placeholder:text-gray-400'}`}
                  rows={2}
                  maxLength={280}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-gray-300'}`}>{postText.length}/280</span>
                  <button
                    disabled={!postText.trim() || posting}
                    onClick={publish}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white active:scale-95 disabled:opacity-40 transition-all"
                    style={{ background: `linear-gradient(135deg,${accent},${isAdmin ? '#7c3aed' : '#ea580c'})` }}>
                    {posting ? t('hub.publishing') : t('hub.publish')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Posts feed */}
          {postsLoading ? (
            <div className="text-center py-10 text-sm text-gray-400 dark:text-slate-500">{t('hub.loading')}</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-10 h-10 text-gray-200 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-gray-400 dark:text-slate-500">{t('hub.emptyFeed')}</p>
            </div>
          ) : posts.map(post => (
            <div key={post.id}
                 className={`rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md fade-in ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>

              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center font-bold text-sm text-white"
                     style={{ background: 'linear-gradient(135deg,#3b82f6,#2563eb)' }}>
                  {post.author_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold truncate ${dark ? 'text-white' : 'text-gray-900'}`}>{post.author_name}</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 capitalize"
                          style={{ background: post.author_role === 'admin' ? 'rgba(168,85,247,0.15)' : 'rgba(249,115,22,0.12)', color: post.author_role === 'admin' ? '#c084fc' : '#fb923c' }}>
                      {post.author_role === 'driver' ? t('hub.roleDriver') : post.author_role === 'admin' ? t('hub.roleAdmin') : t('hub.roleDispatcher')}
                    </span>
                  </div>
                  <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })} · {t('hub.osiTeam')}</p>
                </div>
              </div>

              <p className={`text-sm leading-relaxed mb-3 ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{post.message}</p>

              <div className={`flex items-center gap-4 pt-2.5 border-t ${dark ? 'border-slate-700/60' : 'border-gray-50'}`}>
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${post.liked ? 'text-red-500' : dark ? 'text-slate-500 hover:text-red-400' : 'text-gray-400 hover:text-red-400'}`}>
                  <Heart className="w-3.5 h-3.5" style={{ fill: post.liked ? 'currentColor' : 'none' }} />
                  {post.likes_count}
                </button>
                <span className={`flex items-center gap-1.5 text-xs ${dark ? 'text-slate-600' : 'text-gray-300'}`}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  {t('hub.osiFleet')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/*  LEADERBOARD                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {section === 'leaderboard' && (
        <div className="space-y-3 fade-in">
          <div className={`rounded-2xl p-4 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              <Package className="w-3.5 h-3.5" style={{ color: accent }} /> {t('hub.topDrivers30')}
            </p>
            {leaderboardLoading ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.loading')}</p>
            ) : topDrivers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.noDataYet')}</p>
            ) : (
              <div className="space-y-2">
                {topDrivers.map((d, i) => (
                  <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                    <span className="w-6 text-center font-bold text-sm" style={{ color: i === 0 ? '#eab308' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : accent }}>#{i + 1}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white flex-shrink-0" style={{ background: accentSoft, color: accent }}>
                      {d.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{d.name}</p>
                      <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>★ {d.rating?.toFixed(1) ?? '—'}</p>
                    </div>
                    <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{d.deliveries_30d}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`rounded-2xl p-4 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>
              <DollarSign className="w-3.5 h-3.5" style={{ color: accent }} /> {t('hub.topDispatchers30')}
            </p>
            {leaderboardLoading ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.loading')}</p>
            ) : topDispatchers.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-4 text-center">{t('hub.noDataYet')}</p>
            ) : (
              <div className="space-y-2">
                {topDispatchers.map((d, i) => (
                  <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-xl ${dark ? 'bg-slate-900/50' : 'bg-gray-50'}`}>
                    <span className="w-6 text-center font-bold text-sm" style={{ color: i === 0 ? '#eab308' : i === 1 ? '#94a3b8' : i === 2 ? '#d97706' : accent }}>#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{d.name}</p>
                      <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{d.loads_30d} {t('hub.deliveriesWord')}</p>
                    </div>
                    <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>${d.earned_30d.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/*  SUPPORT                                          */}
      {/* ══════════════════════════════════════════════════ */}
      {section === 'support' && (
        <div className="space-y-3 fade-in">

          {/* OSI Contacts */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: accentSoft }}>
                <PhoneCall className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{t('hub.contactsTitle')}</p>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{t('hub.contactsSubtitle')}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              {([
                { label: t('hub.opsManager'),     phone: '+1 (904) 945-1816', desc: t('hub.opsManagerDesc'),   color: '#22c55e' },
                { label: t('hub.driverSupportLine'),    phone: '+1 (904) 610-3125', desc: t('hub.driverSupportDesc'), color: '#3b82f6' },
              ]).map(c => (
                <a
                  key={c.phone}
                  href={`tel:+${c.phone.replace(/\D/g, '')}`}
                  className={`flex items-center justify-between p-3 rounded-xl group transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold group-hover:text-blue-500 transition-colors ${dark ? 'text-slate-200' : 'text-gray-800'}`}>{c.label}</p>
                      <p className={`text-[11px] truncate ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{c.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="text-[11px] font-mono font-bold whitespace-nowrap" style={{ color: accent }}>{c.phone}</span>
                    <PhoneCall className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Key Policies */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(59,130,246,0.12)' }}>
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
              <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{t('hub.policiesCompliance')}</p>
            </div>
            <div className="space-y-2">
              {([
                { icon: BookOpen,      label: t('hub.manualTitle'),      desc: t('hub.manualDesc'), action: undefined },
                { icon: AlertTriangle, label: t('hub.reportIncident'),             desc: t('hub.reportIncidentDesc'),  action: () => setShowIncidentModal(true) },
                { icon: Briefcase,     label: t('hub.loadAssignment'),            desc: t('hub.loadAssignmentDesc'),  action: undefined },
                { icon: Shield,        label: t('hub.complianceTitle'),        desc: t('hub.complianceDesc'),     action: undefined },
              ]).map(r => (
                <button
                  key={r.label}
                  onClick={r.action}
                  disabled={!r.action}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors group ${r.action ? (dark ? 'hover:bg-white/5' : 'hover:bg-gray-50') : 'cursor-default opacity-70'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: dark ? 'rgba(59,130,246,0.12)' : '#eff6ff' }}>
                    <r.icon className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${dark ? 'text-slate-200' : 'text-gray-800'} ${r.action ? 'group-hover:text-blue-500' : ''} transition-colors`}>{r.label}</p>
                    <p className={`text-[11px] ${dark ? 'text-slate-500' : 'text-gray-400'}`}>{r.desc}</p>
                  </div>
                  {r.action && <ChevronRight className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-slate-600' : 'text-gray-300'} group-hover:text-blue-400 transition-colors`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Quick email */}
          <div className={`rounded-2xl p-5 shadow-sm ${dark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-gray-100'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${dark ? 'text-slate-400' : 'text-gray-400'}`}>{t('hub.directEmails')}</p>
            <div className="space-y-2">
              {([
                { label: t('hub.dispatchOperations'), email: 'dispatch@osilogistics.com' },
                { label: t('hub.billingPayments'),  email: 'billing@osilogistics.com'  },
              ]).map(e => (
                <a
                  key={e.email}
                  href={`mailto:${e.email}`}
                  className={`flex items-center justify-between p-3 rounded-xl transition-colors ${dark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  style={{ border: `1px solid ${dark ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}` }}>
                  <p className={`text-sm font-semibold ${dark ? 'text-slate-300' : 'text-gray-700'}`}>{e.label}</p>
                  <p className="text-xs font-mono whitespace-nowrap flex-shrink-0 ml-2" style={{ color: accent }}>{e.email}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {showIncidentModal && <IncidentReportModal onClose={() => setShowIncidentModal(false)} createIncident={incidentsApi.create} />}
    </div>
  );
}

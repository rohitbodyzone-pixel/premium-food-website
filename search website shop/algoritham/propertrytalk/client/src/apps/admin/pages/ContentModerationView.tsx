import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import {
  ShieldAlert,
  Globe,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Trash2,
  ExternalLink,
} from 'lucide-react';

export const ContentModerationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'WEBSITES' | 'ARTICLES'>('WEBSITES');
  const [miniWebsites, setMiniWebsites] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContent = async () => {
    try {
      setLoading(true);
      const [websitesRes, articlesRes] = await Promise.all([
        api.get<any[]>('/admin/moderation/mini-websites'),
        api.get<any[]>('/admin/moderation/articles'),
      ]);
      setMiniWebsites(websitesRes || []);
      setArticles(articlesRes || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, []);

  const handleToggleWebsiteModeration = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/moderation/mini-websites/${id}`, { isModerated: !current });
      setMiniWebsites((prev) =>
        prev.map((w) => (w.id === id ? { ...w, isModerated: !current } : w))
      );
    } catch (err) {
      console.error('Failed to toggle website moderation:', err);
    }
  };

  const handleToggleArticleModeration = async (id: string, current: boolean) => {
    try {
      await api.put(`/admin/moderation/articles/${id}`, { isModerated: !current });
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isModerated: !current } : a))
      );
    } catch (err) {
      console.error('Failed to toggle article moderation:', err);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-purple-400" />
            <span>Agent Content Moderation</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit agent mini-websites and AI SEO market articles for compliance and authenticity.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-2xl text-xs font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('WEBSITES')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'WEBSITES'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Mini-Websites ({miniWebsites.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ARTICLES')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition ${
              activeTab === 'ARTICLES'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>SEO Articles ({articles.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading content...</div>
      ) : activeTab === 'WEBSITES' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Agent / Agency</th>
                <th className="px-4 py-3.5">Slug URL</th>
                <th className="px-4 py-3.5">Headline</th>
                <th className="px-4 py-3.5">Visitors / Leads</th>
                <th className="px-4 py-3.5">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {miniWebsites.map((w) => (
                <tr key={w.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-white block">
                      {w.expertProfile?.name || 'Agent'}
                    </span>
                    <span className="text-[11px] text-slate-400">{w.agencyName || 'Independent'}</span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="font-mono text-purple-300">/agent/{w.slug}</span>
                  </td>

                  <td className="px-4 py-3.5 max-w-xs truncate text-slate-400">
                    {w.customHeadline || 'No custom headline'}
                  </td>

                  <td className="px-4 py-3.5 text-slate-400">
                    {w.visitorCount || 0} visits / {w.enquiryCount || 0} leads
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleWebsiteModeration(w.id, w.isModerated)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                        w.isModerated
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                          : 'bg-rose-950/60 text-rose-400 border-rose-800/80'
                      }`}
                    >
                      {w.isModerated ? 'Approved' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Article Title</th>
                <th className="px-4 py-3.5">Author</th>
                <th className="px-4 py-3.5">Suburb</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {articles.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/30 transition">
                  <td className="px-5 py-3.5">
                    <span className="font-bold text-white block">{a.title}</span>
                    <span className="text-[10px] text-slate-500 font-mono">Source: {a.source}</span>
                  </td>

                  <td className="px-4 py-3.5 text-slate-300">
                    {a.agentProfile?.name || 'Agent'}
                  </td>

                  <td className="px-4 py-3.5 text-slate-400">
                    {a.targetSuburb ? `${a.targetSuburb}, ${a.targetCity}` : 'NZ General'}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {a.status}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleArticleModeration(a.id, a.isModerated)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                        a.isModerated
                          ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                          : 'bg-rose-950/60 text-rose-400 border-rose-800/80'
                      }`}
                    >
                      {a.isModerated ? 'Approved' : 'Suspended'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

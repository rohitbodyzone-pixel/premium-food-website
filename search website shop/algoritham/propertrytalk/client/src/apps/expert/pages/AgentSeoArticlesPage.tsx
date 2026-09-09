import React, { useState, useEffect } from 'react';
import { AgentArticle } from '../../../types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  Eye,
  AlertTriangle,
  Plus,
  Send,
  Trash2,
  Edit,
  ExternalLink,
  X,
  FileText,
} from 'lucide-react';

interface TopicSuggestion {
  title: string;
  topic: string;
  suburb: string;
  city: string;
}

export const AgentSeoArticlesPage: React.FC = () => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<AgentArticle[]>([]);
  const [suggestions, setSuggestions] = useState<TopicSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Editor Modal State
  const [editingArticle, setEditingArticle] = useState<AgentArticle | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = async () => {
    if (!user?.expertProfile?.id) return;
    try {
      setLoading(true);
      const [articlesRes, suggestionsRes] = await Promise.all([
        api.get<{ articles: AgentArticle[] }>(`/articles/agent/${user.expertProfile.id}`),
        api.get<TopicSuggestion[]>('/articles/topic-suggestions'),
      ]);
      setArticles(articlesRes.articles || []);
      setSuggestions(suggestionsRes || []);
    } catch (err) {
      console.error('Failed to load SEO articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleGenerateDraft = async (topic: TopicSuggestion) => {
    try {
      setGenerating(true);
      const res = await api.post<AgentArticle>('/articles/generate-draft', {
        topic: topic.topic,
        title: topic.title,
        suburb: topic.suburb,
        city: topic.city,
      });
      alert('AI draft generated! Review and approve before publishing.');
      loadData();
    } catch (err: any) {
      console.error('Draft generation failed:', err);
      alert(err.response?.data?.error || err.message || 'Failed to generate draft');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenEdit = (article: AgentArticle) => {
    setEditingArticle(article);
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditSummary(article.summary || '');
  };

  const handleSaveAndPublish = async (status: 'PUBLISHED' | 'AGENT_REVIEW') => {
    if (!editingArticle) return;
    try {
      setSavingEdit(true);
      await api.put(`/articles/${editingArticle.id}`, {
        title: editTitle,
        content: editContent,
        summary: editSummary,
        status,
      });
      setEditingArticle(null);
      loadData();
    } catch (err) {
      console.error('Failed to save article:', err);
      alert('Failed to update article');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-emerald-600" />
          <span>Local SEO Articles & Market Guides</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Generate weekly local property guides, review AI drafts, and establish Google search authority for your suburbs.
        </p>
      </div>

      {/* 1. Weekly Topic Suggestions */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm sm:text-base font-black tracking-tight">
              Weekly Local Topic Suggestions
            </h2>
          </div>
          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Auckland Suburb Trends
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Click to generate an AI-assisted article tailored to your territory with zero duplicate content.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="bg-white/10 hover:bg-white/15 border border-white/10 p-3.5 rounded-2xl flex flex-col justify-between transition"
            >
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  {s.suburb}, {s.city}
                </span>
                <h3 className="font-bold text-xs text-white mt-1 leading-snug">
                  {s.title}
                </h3>
              </div>

              <button
                type="button"
                disabled={generating}
                onClick={() => handleGenerateDraft(s)}
                className="mt-3 w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{generating ? 'Drafting...' : 'Generate AI Draft'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Agent's Article List & Review Pipeline */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <h2 className="text-base font-black text-slate-900 tracking-tight">
          Your Articles & Publications
        </h2>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading articles...</div>
        ) : articles.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {articles.map((article) => {
              const isPublished = article.status === 'PUBLISHED';
              const daysSince = article.daysSinceUpdate || 0;
              const isStale = isPublished && daysSince > 90;

              return (
                <div key={article.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {article.status}
                      </span>
                      {article.targetSuburb && (
                        <span className="text-[11px] text-slate-400 font-semibold">
                          {article.targetSuburb}, {article.targetCity}
                        </span>
                      )}
                      {isStale && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                          <span>90+ Days Stale (Review recommended)</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-slate-900">{article.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-1">{article.summary || article.content.slice(0, 120)}</p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-emerald-600" />
                        <span>{article.viewsCount || 0} reads</span>
                      </span>
                      <span>Source: {article.source}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(article)}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Review / Edit</span>
                    </button>

                    {isPublished && (
                      <a
                        href={`/articles/${article.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-emerald-600"
                        title="View Public Article"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400">
            No published articles yet. Choose a topic suggestion above to start generating local market guides.
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editingArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 relative my-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900">Review & Approve Article</h3>
              </div>
              <button
                onClick={() => setEditingArticle(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Article Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Summary (Meta Description)</label>
                <textarea
                  rows={2}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Body Content (Markdown)</label>
                <textarea
                  rows={10}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleSaveAndPublish('AGENT_REVIEW')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => handleSaveAndPublish('PUBLISHED')}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingEdit ? 'Publishing...' : 'Approve & Publish to Google'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

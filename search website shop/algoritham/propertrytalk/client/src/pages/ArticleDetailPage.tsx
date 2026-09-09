import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AgentArticle } from '../types';
import { api } from '../services/api';
import {
  ArrowLeft,
  Calendar,
  Eye,
  MapPin,
  ShieldCheck,
  Building,
  User,
  Share2,
  BookOpen,
} from 'lucide-react';

export const ArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [article, setArticle] = useState<AgentArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    api.get<AgentArticle>(`/articles/${id}`)
      .then(setArticle)
      .catch((err) => {
        console.error('Failed to load article:', err);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Loading article...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Article Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">This market guide may have been updated or archived.</p>
        <Link
          to="/"
          className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const author = article.agentProfile;
  const authorSlug = author?.user?.name ? author.user.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 pb-28 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title: article.title, url: window.location.href });
            } else {
              navigator.clipboard.writeText(window.location.href);
              alert('Article link copied!');
            }
          }}
          className="p-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
          title="Share Guide"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Article Container */}
      <article className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-xs space-y-6">
        {/* Header Metadata */}
        <div>
          <div className="flex items-center gap-2 flex-wrap text-xs mb-3">
            {article.targetSuburb && (
              <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>{article.targetSuburb}, {article.targetCity}</span>
              </span>
            )}
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(article.createdAt).toLocaleDateString('en-NZ', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-xs sm:text-sm text-slate-500 mt-2.5 leading-relaxed font-medium">
              {article.summary}
            </p>
          )}
        </div>

        {/* Author Byline */}
        {author && (
          <div className="py-3 border-y border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={author.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80'}
                alt={author.name}
                className="w-10 h-10 rounded-full object-cover border border-slate-200"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs sm:text-sm text-slate-900">{author.name}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md">
                    REA Licensed
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{author.businessName || 'Real Estate Specialist'}</p>
              </div>
            </div>

            {authorSlug && (
              <Link
                to={`/agent/${authorSlug}`}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                View Profile &rarr;
              </Link>
            )}
          </div>
        )}

        {/* Article Body Content */}
        <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-700 space-y-4 whitespace-pre-line">
          {article.content}
        </div>

        {/* Author Call to Action Box */}
        {author && (
          <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                Have questions about {article.targetSuburb || 'this area'}?
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Connect directly with {author.name} for free suburban insights and market appraisals.
              </p>
            </div>

            <Link
              to={authorSlug ? `/agent/${authorSlug}` : `/experts/${author.id}`}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
            >
              Contact Agent
            </Link>
          </div>
        )}
      </article>
    </div>
  );
};

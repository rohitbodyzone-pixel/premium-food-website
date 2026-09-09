import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCountry } from '../context/CountryContext';
import { Category, Expert, Property, LiveViewingSession, AgentArticle } from '../types';
import { api } from '../services/api';
import { ExpertCard } from '../components/cards/ExpertCard';
import { PropertyCard } from '../components/cards/PropertyCard';
import { LiveViewingCard } from '../components/cards/LiveViewingCard';
import { ExpertCardSkeleton } from '../components/common/SkeletonLoader';
import {
  Search,
  Home as HomeIcon,
  Landmark,
  Scale,
  ShieldCheck,
  Key,
  Calculator,
  Shield,
  Hammer,
  FileText,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Video,
  Building,
  CheckCircle2,
  BookOpen,
  MapPin,
  Clock,
  ExternalLink,
} from 'lucide-react';

const categoryIconMap: Record<string, React.ElementType> = {
  'real-estate-agent': HomeIcon,
  'mortgage-adviser': Landmark,
  'property-lawyer': Scale,
  'building-inspector': ShieldCheck,
  'property-manager': Key,
  'property-valuer': Calculator,
  'insurance-adviser': Shield,
  'builder-renovation': Hammer,
  'property-tax-adviser': FileText,
  'property-investment-expert': TrendingUp,
};

// 10 categories categorized into Free Help vs Paid Advice
const FREE_HELP_SLUGS = [
  'real-estate-agent',
  'mortgage-adviser',
  'insurance-adviser',
  'property-manager',
];

export const HomePage: React.FC = () => {
  const { selectedCountry } = useCountry();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<LiveViewingSession[]>([]);
  const [onlineExperts, setOnlineExperts] = useState<Expert[]>([]);
  const [recentArticles, setRecentArticles] = useState<AgentArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'properties' | 'experts'>('all');

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        setLoading(true);
        const [catsRes, propsRes, liveRes, expertsRes] = await Promise.allSettled([
          api.get<Category[]>('/categories'),
          api.get<{ properties: Property[] }>('/properties?isFeatured=true&limit=4'),
          api.get<LiveViewingSession[]>('/live-viewings?limit=2'),
          api.get<Expert[]>(`/experts?countryCode=${selectedCountry?.code || 'NZ'}&onlineOnly=true&limit=6`),
        ]);

        if (catsRes.status === 'fulfilled') setCategories(catsRes.value);
        if (propsRes.status === 'fulfilled') setFeaturedProperties(propsRes.value.properties || []);
        if (liveRes.status === 'fulfilled') setUpcomingSessions(liveRes.value || []);
        if (expertsRes.status === 'fulfilled') setOnlineExperts(expertsRes.value || []);

        // Attempt to fetch articles
        try {
          const articlesRes = await api.get<{ articles: AgentArticle[] }>('/articles/recent?limit=3');
          setRecentArticles(articlesRes.articles || []);
        } catch {
          // fallback if endpoint not populated
        }
      } catch (err) {
        console.error('Failed to load home page data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHomeData();
  }, [selectedCountry]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (searchType === 'properties') {
      navigate(`/explore?search=${encodeURIComponent(searchQuery.trim())}&tab=properties`);
    } else if (searchType === 'experts') {
      navigate(`/experts?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/explore?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const freeHelpCategories = categories.filter((c) => FREE_HELP_SLUGS.includes(c.slug));
  const paidAdviceCategories = categories.filter((c) => !FREE_HELP_SLUGS.includes(c.slug));

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-5 pb-28 space-y-8">
      {/* 1. HERO SECTION & UNIVERSAL SEARCH */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-9 shadow-xl relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Zealand Property Platform</span>
            </span>
            <span className="text-xs text-slate-300 font-medium">
              Verified REA Agents • Remote Live Viewings • Free & Paid Advice
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            Find property, book live viewings, or consult verified pros.
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Direct access to properties across Auckland, Wellington, and Christchurch, with instant video consultations and 10-minute live remote viewings.
          </p>

          {/* Universal Search Box */}
          <form onSubmit={handleSearchSubmit} className="mt-6">
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl flex flex-col sm:flex-row gap-1.5">
              <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1.5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSearchType('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    searchType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSearchType('properties')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    searchType === 'properties' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  Properties
                </button>
                <button
                  type="button"
                  onClick={() => setSearchType('experts')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    searchType === 'experts' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-200 hover:text-white'
                  }`}
                >
                  Pros
                </button>
              </div>

              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchType === 'properties'
                      ? 'Search by suburb, city, or address (e.g. Ponsonby, Auckland)...'
                      : searchType === 'experts'
                      ? 'Search lawyer, mortgage adviser, inspector...'
                      : 'Search properties, suburbs, or verified professionals...'
                  }
                  className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-400 focus:outline-hidden placeholder:text-slate-400 shadow-inner"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-md flex items-center justify-center gap-1.5 active:scale-95"
              >
                <span>Search</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Fast Link Pills */}
          <div className="flex items-center gap-2 mt-4 flex-wrap text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Quick links:</span>
            <Link
              to="/explore?type=SALE&tab=properties"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-semibold transition"
            >
              Houses for Sale
            </Link>
            <Link
              to="/explore?type=RENT&tab=properties"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-semibold transition"
            >
              Rentals
            </Link>
            <Link
              to="/live-viewings"
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold transition flex items-center gap-1"
            >
              <Video className="w-3 h-3" /> Live Viewings
            </Link>
            <Link
              to="/experts?category=real-estate-agent"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-semibold transition"
            >
              REA Agents
            </Link>
          </div>
        </div>
      </div>

      {/* 2. UPCOMING REMOTE LIVE VIEWINGS CALLOUT */}
      {upcomingSessions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Remote Live Property Viewings</span>
                  <span className="text-[10px] font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Interactive
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Fixed 10-minute HD walkthroughs. Group $20 (min 5 required) or Private $60.
                </p>
              </div>
            </div>
            <Link
              to="/live-viewings"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>See all viewings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingSessions.map((session) => (
              <LiveViewingCard key={session.id} session={session} />
            ))}
          </div>
        </section>
      )}

      {/* 3. FEATURED PROPERTIES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Featured Properties
              </h2>
              <p className="text-xs text-slate-500">
                Verified agent and private seller listings across New Zealand
              </p>
            </div>
          </div>
          <Link
            to="/explore"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>Explore all ({featuredProperties.length}+)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
            <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
          </div>
        ) : featuredProperties.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredProperties.map((prop) => (
              <PropertyCard key={prop.id} property={prop} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center">
            <Building className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No featured properties listed yet.</p>
          </div>
        )}
      </section>

      {/* 4. PROFESSIONAL MARKETPLACE - 10 CATEGORIES (FREE HELP VS PAID ADVICE) */}
      <section className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              10 Verified Professions
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-1.5">
            Connect with Verified Property Professionals
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Free property help from commission-based advisers, plus verified paid advice with a 60-second free preview.
          </p>
        </div>

        {/* Category Group 1: Free Property Help */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                Free Property Help
              </h3>
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                100% Free Initial Advice & Inquiries
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {freeHelpCategories.map((cat) => {
              const IconComp = categoryIconMap[cat.slug] || HomeIcon;
              return (
                <Link
                  key={cat.id}
                  to={`/experts?category=${cat.slug}`}
                  className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-emerald-500 hover:bg-emerald-50/30 transition group flex flex-col justify-between"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition mb-2">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">
                      {cat.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {cat.description || 'Verified advice'}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                    <span>Ask free questions</span>
                    <span>&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Category Group 2: Paid Expert Advice */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">
                Paid Expert Advice
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3" />
                First 60s Free • Authoritative Advice
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {paidAdviceCategories.map((cat) => {
              const IconComp = categoryIconMap[cat.slug] || Scale;
              return (
                <Link
                  key={cat.id}
                  to={`/experts?category=${cat.slug}`}
                  className="p-3.5 rounded-2xl border border-slate-200/90 hover:border-indigo-500 hover:bg-indigo-50/30 transition group flex flex-col justify-between"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition mb-2">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-indigo-700 transition line-clamp-1">
                      {cat.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {cat.description || 'Verified licensed professional'}
                    </p>
                  </div>
                  <div className="mt-2 text-[10px] font-bold text-indigo-600 flex items-center gap-0.5">
                    <span>60s free preview</span>
                    <span>&rarr;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. ONLINE EXPERTS NOW */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Property Professionals Online Now
            </h2>
          </div>
          <Link
            to="/experts"
            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>All experts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            <ExpertCardSkeleton />
            <ExpertCardSkeleton />
          </div>
        ) : onlineExperts.length > 0 ? (
          <div className="space-y-3">
            {onlineExperts.slice(0, 3).map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 text-center">
            <p className="text-xs text-slate-500">
              No experts are currently online. You can view all experts and book advance consultations.
            </p>
            <Link
              to="/experts"
              className="mt-3 inline-block px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              Browse All Verified Pros
            </Link>
          </div>
        )}
      </section>

      {/* 6. LOCAL ARTICLES & GUIDES BY VERIFIED AGENTS */}
      <section className="bg-slate-50 border border-slate-200/80 rounded-3xl p-5 sm:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Local Market Guides & Insights
              </h2>
              <p className="text-xs text-slate-500">
                Fresh, verified suburban advice from local licensed real estate agents
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Guide Card 1 */}
          <Link
            to="/agent/sarah-jenkins"
            className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-emerald-500 transition shadow-2xs group"
          >
            <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-bold mb-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>Auckland Central & St Marys Bay</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
              Why St Marys Bay & Ponsonby Are High-Demand Heritage Suburbs in 2026
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              Learn about zoning rules, villa renovation consents, and how remote live viewings are speeding up sales.
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">By Sarah Jenkins (REA Licensed)</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                Read guide &rarr;
              </span>
            </div>
          </Link>

          {/* Guide Card 2 */}
          <Link
            to="/agent/sarah-jenkins"
            className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-emerald-500 transition shadow-2xs group"
          >
            <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-bold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Buyer Due Diligence</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
              Essential NZ Due Diligence: LIMs, Weathertightness, and Solicitor Approval
            </h3>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              Everything you must verify before signing an unconditional agreement in New Zealand.
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">Bayleys Real Estate Auckland</span>
              <span className="font-bold text-emerald-600 flex items-center gap-0.5">
                Read guide &rarr;
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

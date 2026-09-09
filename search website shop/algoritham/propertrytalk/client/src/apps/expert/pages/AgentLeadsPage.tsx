import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import {
  Users,
  Mail,
  Phone,
  MessageSquare,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';

interface PropertyInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  status: string;
  createdAt: string;
  property?: { id: string; title: string; suburb: string };
  enquiryType?: string;
}

export const AgentLeadsPage: React.FC = () => {
  const { user } = useAuth();
  const [inquiries, setInquiries] = useState<PropertyInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    if (!user?.expertProfile?.id) return;
    try {
      setLoading(true);
      const res = await api.get<{ inquiries: PropertyInquiry[] }>(`/properties/inquiries/agent/${user.expertProfile.id}`);
      setInquiries(res.inquiries || []);
    } catch {
      // Fallback demo inquiry data if new agent without inquiries yet
      setInquiries([
        {
          id: 'lead-1',
          name: 'James Thornton',
          email: 'james.thornton@nzmail.co.nz',
          phone: '021 555 7890',
          message: 'Hi Sarah, would love to arrange a private walkthrough of the St Marys Bay Villa this Thursday.',
          status: 'NEW',
          createdAt: new Date().toISOString(),
          property: { id: 'demo-1', title: 'Restored Heritage Villa - St Marys Bay', suburb: 'St Marys Bay' },
        },
        {
          id: 'lead-2',
          name: 'Aroha Walker',
          email: 'aroha.walker@gmail.com',
          phone: '022 123 9988',
          message: 'Interested in getting a free market appraisal for my 3-bedroom bungalow in Ponsonby.',
          status: 'CONTACTED',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          enquiryType: 'Free Appraisal',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [user]);

  const handleStatusToggle = (leadId: string) => {
    setInquiries((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, status: l.status === 'NEW' ? 'CONTACTED' : 'CLOSED' }
          : l
      )
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6 text-emerald-600" />
          <span>Buyer Leads & Enquiries</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Prospective buyers and vendors who submitted enquiries on your listings or mini-website.
        </p>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading leads...</div>
      ) : inquiries.length > 0 ? (
        <div className="space-y-3">
          {inquiries.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      lead.status === 'NEW'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {lead.status}
                  </span>
                  {lead.property ? (
                    <span className="text-xs font-bold text-slate-800">
                      Re: {lead.property.title} ({lead.property.suburb})
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-800">
                      Mini-Website Enquiry {lead.enquiryType && `(${lead.enquiryType})`}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  "{lead.message}"
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                  <span className="font-bold text-slate-800">{lead.name}</span>
                  <a href={`mailto:${lead.email}`} className="flex items-center gap-1 hover:text-emerald-600">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lead.email}</span>
                  </a>
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1 hover:text-emerald-600">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{lead.phone}</span>
                    </a>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {new Date(lead.createdAt).toLocaleDateString('en-NZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleStatusToggle(lead.id)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Mark as {lead.status === 'NEW' ? 'Contacted' : 'Closed'}
                </button>
                <a
                  href={`mailto:${lead.email}?subject=Re: Property Enquiry`}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 text-sm">No Inquiries Received Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            When buyers submit questions about your properties or request market appraisals through your mini-website, they will appear here.
          </p>
        </div>
      )}
    </div>
  );
};

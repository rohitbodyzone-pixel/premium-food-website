import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Star, X, CheckCircle2, Bookmark } from 'lucide-react';
import { api } from '../../services/api';

export const ReviewModal: React.FC = () => {
  const { reviewPendingExpertId, setReviewPendingExpertId } = useSocket();
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState('');
  const [saveExpert, setSaveExpert] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!reviewPendingExpertId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      alert('Please write a short review note.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/reviews', {
        expertId: reviewPendingExpertId,
        rating,
        comment: comment.trim(),
      });

      if (saveExpert) {
        await api.post(`/experts/${reviewPendingExpertId}/save`).catch(() => {});
      }

      setSubmitted(true);
      setTimeout(() => {
        setReviewPendingExpertId(null);
        setSubmitted(false);
        setComment('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative">
        <button
          onClick={() => setReviewPendingExpertId(null)}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-xl font-bold text-slate-900">Thank You!</h3>
            <p className="text-sm text-slate-500 mt-1">Your feedback helps verify professional quality.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                Consultation Feedback
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-2">
                Rate Your Experience
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                How was your advice session with this property professional?
              </p>
            </div>

            {/* Star selector */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 text-slate-300 hover:text-amber-400 transition"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Comment input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Your Review
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share how helpful their advice was (e.g. prompt, knowledgeable on local market)..."
                rows={3}
                required
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden resize-none"
              />
            </div>

            {/* Save expert checkbox */}
            <label className="flex items-center gap-2.5 text-xs text-slate-600 mb-6 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveExpert}
                onChange={(e) => setSaveExpert(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                Save expert to my saved list for future consultations
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Rating & Review'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import {
  Bell,
  MessageSquare,
  PhoneCall,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Settings,
  Sliders,
  AlertCircle,
  CreditCard,
  Lock,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  priority: string;
  createdAt: string;
  readAt?: string | null;
}

interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  chatAlerts: boolean;
  callAlerts: boolean;
  bookingUpdates: boolean;
  appointmentReminders: boolean;
  paymentReceipts: boolean;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'calls' | 'bookings' | 'billing'>('all');

  // Preferences Modal
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    inAppEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    chatAlerts: true,
    callAlerts: true,
    bookingUpdates: true,
    appointmentReminders: true,
    paymentReceipts: true,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushStatusMessage, setPushStatusMessage] = useState<string | null>(null);
  const [testingPush, setTestingPush] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>('/notifications');
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const prefs = await api.get<NotificationPreferences>('/notifications/preferences');
      if (prefs) setPreferences(prefs);
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    loadPreferences();

    if (socket) {
      const handleIncoming = (newNotif: NotificationItem) => {
        setNotifications((prev) => [newNotif, ...prev]);
        setUnreadCount((prev) => prev + 1);
      };
      socket.on('notification:new', handleIncoming);
      return () => {
        socket.off('notification:new', handleIncoming);
      };
    }
  }, [user, socket]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all notifications?')) return;
    try {
      await api.delete('/notifications/all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  const handleSavePreferences = async (newPrefs: NotificationPreferences) => {
    setPreferences(newPrefs);
    try {
      setSavingPrefs(true);
      await api.patch('/notifications/preferences', newPrefs);
    } catch (err) {
      console.error('Error updating preferences:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleTogglePush = async (enabled: boolean) => {
    setPushStatusMessage(null);
    if (!enabled) {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await sub.unsubscribe();
            await api.post('/notifications/push/unsubscribe', { endpoint: sub.endpoint });
          }
        }
      } catch (e) {
        console.warn('Push unsubscribe cleanup error:', e);
      }
      await handleSavePreferences({ ...preferences, pushEnabled: false });
      return;
    }

    if (!('Notification' in window)) {
      setPushStatusMessage('Push notifications not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushStatusMessage('Permission not granted by browser.');
        return;
      }

      const config = await api.get<{ pushEnabled: boolean; publicKey: string | null; mode: string }>(
        '/notifications/push/config'
      );

      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;

          if (config.publicKey) {
            const convertedVapidKey = urlBase64ToUint8Array(config.publicKey);
            const subscription = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey,
            });

            await api.post('/notifications/push/subscribe', subscription);
            setPushStatusMessage('Browser push active with VAPID credentials.');
          } else {
            setPushStatusMessage('Push enabled (development mode: in-app real-time alerts active).');
          }
        } catch (swErr) {
          console.warn('Service worker registration note:', swErr);
          setPushStatusMessage('Push enabled with in-app alert fallback.');
        }
      }

      await handleSavePreferences({ ...preferences, pushEnabled: true });
    } catch (err: any) {
      console.error('Failed to enable push notifications:', err);
      setPushStatusMessage(err.message || 'Failed to enable push notifications.');
    }
  };

  const handleSendTestPush = async () => {
    try {
      setTestingPush(true);
      setPushStatusMessage('Sending test push notification...');
      const res = await api.post<{ success: boolean; result: any }>('/notifications/push/test');
      if (res.success) {
        setPushStatusMessage('Test push notification sent! Check your device notifications.');
      } else {
        setPushStatusMessage('Could not dispatch test push notification.');
      }
    } catch (err: any) {
      console.error('Failed to send test push:', err);
      setPushStatusMessage(err.response?.data?.error || err.message || 'Failed to send test push');
    } finally {
      setTestingPush(false);
    }
  };

  const getTargetLink = (n: NotificationItem) => {
    const data = n.data || {};
    if (data.chatId) return `/chat/${data.chatId}`;
    if (data.appointmentId) return `/appointments`;
    if (n.type.includes('CALL')) return `/calls`;
    if (n.type.includes('APPOINTMENT')) return `/appointments`;
    if (n.type.includes('PAYMENT') || n.type.includes('REFUND')) return user?.role === 'EXPERT' ? '/earnings' : '/wallet';
    return '/';
  };

  const getIcon = (type: string) => {
    if (type.includes('CHAT')) return <MessageSquare className="w-4 h-4 text-emerald-600" />;
    if (type.includes('CALL')) return <PhoneCall className="w-4 h-4 text-blue-600" />;
    if (type.includes('APPOINTMENT')) return <Calendar className="w-4 h-4 text-purple-600" />;
    if (type.includes('PAYMENT') || type.includes('REFUND')) return <CreditCard className="w-4 h-4 text-emerald-600" />;
    if (type.includes('VERIFICATION') || type.includes('SECURITY')) return <ShieldCheck className="w-4 h-4 text-amber-600" />;
    return <Bell className="w-4 h-4 text-slate-600" />;
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'calls') return n.type.includes('CALL') || n.type.includes('CHAT');
    if (activeFilter === 'bookings') return n.type.includes('APPOINTMENT');
    if (activeFilter === 'billing') return n.type.includes('PAYMENT') || n.type.includes('REFUND');
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 space-y-4">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {unreadCount} new
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime alerts on consultations, incoming calls, bookings, and payments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreferences(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            title="Notification Preferences"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {notifications.length > 0 && (
            <>
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-lg transition"
              >
                Mark read
              </button>
              <span className="text-slate-300">•</span>
              <button
                onClick={handleClearAll}
                className="text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveFilter('all')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveFilter('calls')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeFilter === 'calls' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Chats & Calls
        </button>
        <button
          onClick={() => setActiveFilter('bookings')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeFilter === 'bookings' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Appointments
        </button>
        <button
          onClick={() => setActiveFilter('billing')}
          className={`flex-1 py-1.5 rounded-lg transition ${
            activeFilter === 'billing' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'hover:text-slate-900'
          }`}
        >
          Billing
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            Loading notifications...
          </div>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map((n) => {
            const isRead = Boolean(n.readAt);
            const timeAgo = new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

            return (
              <div
                key={n.id}
                className={`p-4 rounded-2xl border transition flex items-start gap-3.5 group shadow-xs ${
                  isRead
                    ? 'bg-white border-slate-200/90'
                    : 'bg-emerald-50/40 border-emerald-300/80 ring-1 ring-emerald-400/20'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  {getIcon(n.type)}
                </div>

                <Link
                  to={getTargetLink(n)}
                  onClick={() => !isRead && handleMarkAsRead(n.id)}
                  className="flex-1 min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {dateStr}, {timeAgo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {n.body}
                  </p>
                </Link>

                <div className="flex items-center gap-1 shrink-0 mt-1">
                  {!isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(n.id, e)}
                      title="Mark as read"
                      className="w-2.5 h-2.5 rounded-full bg-emerald-500 hover:scale-125 transition"
                    />
                  )}

                  <button
                    onClick={(e) => handleDelete(n.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 text-center">
            <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No notifications in this filter.</p>
          </div>
        )}
      </div>

      {/* Preferences Modal */}
      {showPreferences && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-600" />
                <h2 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Notification Preferences
                </h2>
              </div>
              <button
                onClick={() => setShowPreferences(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-400">
                Delivery Channels
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <div>
                  <span className="font-bold block text-slate-900">In-App Notifications</span>
                  <span className="text-[11px] text-slate-500">Live sound alerts and badges in portal</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.inAppEnabled}
                  onChange={(e) => handleSavePreferences({ ...preferences, inAppEnabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <div>
                  <span className="font-bold block text-slate-900">Email Notifications</span>
                  <span className="text-[11px] text-slate-500">Booking receipts and appointment confirmations</span>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.emailEnabled}
                  onChange={(e) => handleSavePreferences({ ...preferences, emailEnabled: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <div>
                  <span className="font-bold block text-slate-900">Browser Push Notifications</span>
                  <span className="text-[11px] text-slate-500">Desktop and mobile browser push alerts</span>
                  {pushStatusMessage && (
                    <div className="text-[10px] text-emerald-600 font-medium mt-1">
                      {pushStatusMessage}
                    </div>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={preferences.pushEnabled}
                  onChange={(e) => handleTogglePush(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              {preferences.pushEnabled && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200">
                  <div>
                    <span className="font-bold block text-emerald-950 text-xs">Verify Real Push</span>
                    <span className="text-[11px] text-emerald-700">Send an instant test alert to this phone/browser</span>
                  </div>
                  <button
                    type="button"
                    disabled={testingPush}
                    onClick={handleSendTestPush}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 shadow-xs"
                  >
                    {testingPush ? 'Sending...' : 'Send Test Alert'}
                  </button>
                </div>
              )}

              <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px] text-slate-400 pt-2">
                Alert Types
              </div>

              <div className="flex items-center justify-between p-2">
                <span>Chat & Messaging Alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.chatAlerts}
                  onChange={(e) => handleSavePreferences({ ...preferences, chatAlerts: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2">
                <span>Incoming Call Alerts</span>
                <input
                  type="checkbox"
                  checked={preferences.callAlerts}
                  onChange={(e) => handleSavePreferences({ ...preferences, callAlerts: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2">
                <span>Appointment Confirmations & Changes</span>
                <input
                  type="checkbox"
                  checked={preferences.bookingUpdates}
                  onChange={(e) => handleSavePreferences({ ...preferences, bookingUpdates: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2">
                <span>24h and 1h Appointment Reminders</span>
                <input
                  type="checkbox"
                  checked={preferences.appointmentReminders}
                  onChange={(e) => handleSavePreferences({ ...preferences, appointmentReminders: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-2">
                <span>Billing & Payment Receipts</span>
                <input
                  type="checkbox"
                  checked={preferences.paymentReceipts}
                  onChange={(e) => handleSavePreferences({ ...preferences, paymentReceipts: e.target.checked })}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowPreferences(false)}
                className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  deepLink: string;
  sentAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    if (document.visibilityState !== 'visible') return;

    try {
      const res = await fetch('/api/notifications', { signal });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Failed to fetch notifications:', error);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchNotifications(controller.signal);

    const interval = setInterval(() => fetchNotifications(controller.signal), 30000);
    const onVisibilityChange = () => fetchNotifications(controller.signal);

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      controller.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchNotifications]);

  const markAllRead = async () => {
    try {
      await fetch('/api/notifications', { method: 'POST' });
      setNotifications([]);
    } catch (error) {
      console.error('Failed to mark notifications read:', error);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-[#F4F4F0]/60 hover:text-lime transition-colors"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 h-4 w-4 bg-lime text-[#000000] font-mono text-[10px] font-bold rounded-full flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111111] border border-[#242424] rounded-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-[#242424] flex items-center justify-between">
            <h3 className="font-mono text-xs tracking-[0.25em] uppercase text-[#F4F4F0]">
              Transmissions
            </h3>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="font-mono text-[10px] tracking-[0.2em] uppercase text-lime hover:text-[#F4F4F0]"
              >
                Clear All
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center font-mono text-xs text-[#F4F4F0]/40 tracking-wider uppercase">
                No new transmissions
              </div>
            ) : (
              notifications.map((notif) => (
                <a
                  key={notif.id}
                  href={notif.deepLink}
                  className="block p-4 border-b border-[#1c1c1c] hover:bg-[#161616] transition-colors"
                >
                  <p className="font-display font-semibold text-sm text-[#F4F4F0]">{notif.title}</p>
                  <p className="font-mono text-xs text-[#F4F4F0]/50 mt-1">{notif.message}</p>
                  <p className="font-mono text-[10px] text-[#F4F4F0]/30 mt-2 tracking-wider">
                    {new Date(notif.sentAt).toLocaleString()}
                  </p>
                </a>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

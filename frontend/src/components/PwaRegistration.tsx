'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  // Convert base64url string -> base64 -> binary string -> Uint8Array
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function PwaRegistration() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (globalThis.window === undefined || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      // In local dev, service worker cache can serve stale chunks/pages.
      const disableForDev = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      };
      void disableForDev();

      // Optional: mimic incognito-like clean auth session on every local load.
      // Enable by setting NEXT_PUBLIC_DEV_FRESH_SESSION=true in frontend/.env.local.
      const freshSessionEnabled =
        process.env.NEXT_PUBLIC_DEV_FRESH_SESSION === 'true';
      if (freshSessionEnabled) {
        const markerKey = '__bgn_dev_fresh_session_applied__';
        const alreadyApplied = localStorage.getItem(markerKey) === 'true';
        if (!alreadyApplied) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          sessionStorage.clear();
          localStorage.setItem(markerKey, 'true');
        }
      }
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch {
        // Ignore registration failures so app usage is not blocked.
      }
    };

    register();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!('Notification' in globalThis) || !('serviceWorker' in navigator))
      return;

    const subscribe = async () => {
      try {
        const permission =
          globalThis.Notification?.permission ?? 'default';
        const desiredPermission =
          permission === 'default'
            ? await globalThis.Notification.requestPermission()
            : permission;

        if (desiredPermission !== 'granted') return;

        const vapid = await api.get<{ publicKey: string }>(
          '/notifications/push/vapid-public-key',
          { auth: false, showErrorToast: false },
        );

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) return;

        const applicationServerKey = urlBase64ToUint8Array(vapid.publicKey);
        const applicationServerKeyBuffer =
          applicationServerKey.buffer as ArrayBuffer;

        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKeyBuffer,
        });

        const subscriptionJson = newSubscription.toJSON();

        await api.post('/notifications/push/subscribe', subscriptionJson, {
          showErrorToast: false,
        });
      } catch {
        // Best-effort: never block app usage on push subscription failures.
      }
    };

    void subscribe();
  }, [user?.id]);

  return null;
}

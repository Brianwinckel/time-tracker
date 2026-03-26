// ============================================================
// Push notification utilities — subscribe, permission, local notify
// ============================================================

import { supabase } from '../lib/supabase';

const VAPID_PUBLIC_KEY = 'BBxUTgPR4P5tetnDSghG0v4JvRtf0JimhHfv7FAHAlCHm4zrdT4Mptyt9NzVr8L08Uo6z2Mhwynbk0kndCV5zw4';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Check if push notifications are supported */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Get current permission state */
export function getPushPermission(): NotificationPermission {
  if (!isPushSupported()) return 'denied';
  return Notification.permission;
}

/** Request notification permission and subscribe to push */
export async function subscribeToPush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const subJson = subscription.toJSON();

    // Save to Supabase
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subJson.endpoint,
        keys_p256dh: subJson.keys?.p256dh ?? '',
        keys_auth: subJson.keys?.auth ?? '',
      }, { onConflict: 'user_id,endpoint' });

    if (error) {
      console.error('Failed to save push subscription:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Push subscription failed:', err);
    return false;
  }
}

/** Unsubscribe from push */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  if (!isPushSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', endpoint);
    }
  } catch (err) {
    console.error('Push unsubscribe failed:', err);
  }
}

/** Send a local notification (no server needed — for idle warnings) */
export function sendLocalNotification(title: string, body: string, tag?: string): void {
  if (!isPushSupported() || Notification.permission !== 'granted') return;

  // Use service worker notification for better reliability
  navigator.serviceWorker.ready.then(registration => {
    registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: tag || 'timetracker-local',
    });
  });
}

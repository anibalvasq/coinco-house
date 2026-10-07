/**
 * Web Push (PWA notifications): new bills from other household members
 * and each person's share at month close.
 *
 * iOS only supports Web Push (16.4+) when the app was added to the home screen.
 * The Capacitor native shell has no Web Push; it reports "unsupported".
 */
import { Capacitor } from "@capacitor/core";
import { api } from "./api/client.js";

export type PushStatus =
  | "on"
  | "off"
  | "denied"        // blocked in browser settings
  | "ios-install"   // iPhone/iPad in a Safari tab: must add to home screen first
  | "unsupported"   // browser/dev mode/native shell without Web Push
  | "disabled";     // server has no VAPID keys configured

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function browserSupportsPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (Capacitor.isNativePlatform()) return "unsupported";
  if (!browserSupportsPush()) return isIos() && !isStandalone() ? "ios-install" : "unsupported";
  if (!(await navigator.serviceWorker.getRegistration())) return "unsupported";
  try {
    if (!(await api.pushPublicKey()).enabled) return "disabled";
  } catch {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return (await currentSubscription()) ? "on" : "off";
}

/** Must run from a click handler: Safari only shows the permission prompt on a user gesture. */
export async function enablePush(): Promise<PushStatus> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const { public_key } = await api.pushPublicKey();
  if (!public_key) return "disabled";
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    }));
  await api.pushSubscribe(sub.toJSON());
  return "on";
}

export async function disablePush(): Promise<void> {
  if (!browserSupportsPush()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await api.pushUnsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/** Re-link this device's existing subscription to whoever is logged in now. */
export async function syncPushSubscription(): Promise<void> {
  if (Capacitor.isNativePlatform() || !browserSupportsPush()) return;
  if (Notification.permission !== "granted") return;
  const sub = await currentSubscription();
  if (sub) await api.pushSubscribe(sub.toJSON()).catch(() => {});
}

// Instagram link handling for the installed iOS app (Capacitor shell).
// iOS does not reliably hand https://www.instagram.com links to the Instagram
// app when opened from an app (it often opens Safari instead), unlike TikTok/X.
// So, only inside the native iOS app, try Instagram's own instagram:// address
// first and fall back to the normal web link if Instagram isn't installed.
// On the normal website this does nothing and the plain link is used.
import type { MouseEvent } from "react";

export const INSTAGRAM_URL = "https://www.instagram.com/ball.findr/";
const INSTAGRAM_APP_URL = "instagram://user?username=ball.findr";

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return !!cap?.isNativePlatform?.() && cap.getPlatform?.() === "ios";
}

export function handleInstagramClick(e: MouseEvent<HTMLAnchorElement>) {
  if (!isNativeIOS()) return;
  e.preventDefault();
  let left = false;
  const onHide = () => {
    if (document.visibilityState === "hidden") left = true;
  };
  document.addEventListener("visibilitychange", onHide);
  window.location.href = INSTAGRAM_APP_URL;
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onHide);
    // Instagram app didn't open (not installed): open the web profile in Safari.
    if (!left) window.location.href = INSTAGRAM_URL;
  }, 1500);
}

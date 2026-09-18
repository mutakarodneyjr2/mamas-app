/**
 * External Intent & Link Handler for MAMAS Native & Web
 * Safely handles tel:, mailto:, WhatsApp intents, and external URLs in WebViews without trapping the user.
 */

let capBrowserPlugin: any = null;

async function getCapacitorBrowser() {
  if (capBrowserPlugin) return capBrowserPlugin;
  if (typeof window === 'undefined') return null;

  // 1. Check window.Capacitor.Plugins.Browser
  const cap = (window as any).Capacitor;
  if (cap?.Plugins?.Browser) {
    capBrowserPlugin = cap.Plugins.Browser;
    return capBrowserPlugin;
  }

  // 2. Dynamic import if installed
  try {
    const mod = await (Function('return import("@capacitor/browser")')() as Promise<any>);
    if (mod?.Browser) {
      capBrowserPlugin = mod.Browser;
      return capBrowserPlugin;
    }
  } catch {
    // Web environment or package not bundled
  }
  return null;
}

/**
 * Safely opens an external web URL.
 * Uses Capacitor Browser in in-app Chrome Custom Tabs / SFSafariViewController on mobile,
 * or standard new tab with security attributes on the web.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;

  const Browser = await getCapacitorBrowser();
  if (Browser && typeof Browser.open === 'function') {
    try {
      await Browser.open({ url, presentationStyle: 'popover' });
      return;
    } catch (err) {
      console.warn('[openExternal] Capacitor Browser.open error, falling back:', err);
    }
  }

  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.assign(url);
    }
  } catch {
    window.location.href = url;
  }
}

/**
 * Triggers native phone dialer with phone number.
 */
export function openTel(phone: string): void {
  if (!phone) return;
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  if (!cleanPhone) return;
  window.location.href = `tel:${cleanPhone}`;
}

/**
 * Triggers native mail client.
 */
export function openMailto(email: string, subject?: string, body?: string): void {
  if (!email) return;
  const params: string[] = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  const query = params.length > 0 ? `?${params.join('&')}` : '';
  window.location.href = `mailto:${email}${query}`;
}

/**
 * Opens WhatsApp chat.
 * Tries native WhatsApp protocol scheme handoff in native app/mobile,
 * and falls back to wa.me via openExternalUrl.
 */
export async function openWhatsApp(phoneDigits: string, text?: string): Promise<void> {
  if (!phoneDigits) return;
  const clean = phoneDigits.replace(/[^0-9]/g, '');
  if (!clean) return;

  const textParam = text ? `&text=${encodeURIComponent(text)}` : '';
  const nativeUrl = `whatsapp://send?phone=${clean}${textParam}`;
  const webUrl = `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
  if (isCapacitor) {
    try {
      window.location.href = nativeUrl;
      return;
    } catch (e) {
      console.warn('[openExternal] Could not invoke whatsapp:// scheme:', e);
    }
  }

  await openExternalUrl(webUrl);
}

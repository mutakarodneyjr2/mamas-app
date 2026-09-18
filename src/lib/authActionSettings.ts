import { ActionCodeSettings } from 'firebase/auth';

/**
 * Returns centralized ActionCodeSettings for Firebase Auth emails (email verification & password reset).
 * Configured so verification and reset links return users back to the MAMAS web application or
 * launch the Android/iOS native app with deep linking.
 */
export function getAuthActionSettings(customPath: string = '/login'): ActionCodeSettings {
  // Determine production domain / base URL
  const appUrl = (
    import.meta.env.VITE_PUBLIC_APP_URL ||
    import.meta.env.VITE_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/+$/, '');

  const normalizedPath = customPath.startsWith('/') ? customPath : `/${customPath}`;
  const continueUrl = `${appUrl || 'https://mamas.org'}${normalizedPath}`;

  // Android package name and iOS bundle identifier
  // TODO: Update VITE_ANDROID_PACKAGE and VITE_IOS_BUNDLE_ID in environment or build configs when publishing to Google Play / App Store
  const androidPackage = import.meta.env.VITE_ANDROID_PACKAGE || 'org.mamas.alumni';
  const iosBundleId = import.meta.env.VITE_IOS_BUNDLE_ID || 'org.mamas.alumni';

  return {
    url: continueUrl,
    handleCodeInApp: true,
    android: {
      packageName: androidPackage,
      installApp: true,
      minimumVersion: '1',
    },
    iOS: {
      bundleId: iosBundleId,
    },
  };
}

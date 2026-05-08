import { useState, useEffect } from 'react';
import { getAppRelease } from '../appwrite/database';

// Current app version — bump this in package.json and here when you release
export const CURRENT_VERSION = '1.0.0';

/**
 * Compare semver strings. Returns true if `remote` is newer than `current`.
 * e.g. isNewer('1.2.0', '1.0.0') → true
 */
function isNewer(remote, current) {
  if (!remote) return false;
  const parse = v => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [cMaj, cMin, cPat] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

/**
 * Detect current platform.
 * In Electron: uses process.platform via IPC (if implemented) or userAgent.
 * In web: userAgent only.
 */
function detectPlatform() {
  const ua = navigator.userAgent;
  // Order matters: check Mac before Win (some UAs contain both strings)
  if (/Mac|iPhone|iPad|iPod/i.test(ua))  return 'mac';
  if (/Win/i.test(ua))                   return 'windows';
  if (/Linux|Android/i.test(ua))         return 'linux';
  return null;
}

/**
 * Hook: checks Appwrite for a newer app version on mount.
 * Returns { updateAvailable, release, platform, downloadUrl, dismiss }
 */
export function useUpdateCheck() {
  const [state, setState] = useState({
    updateAvailable: false,
    release: null,
    platform: detectPlatform(),
    downloadUrl: null,
    dismissed: false,
  });

  useEffect(() => {
    let mounted = true;
    async function check() {
      try {
        const release = await getAppRelease();
        if (!release || !mounted) return;

        if (isNewer(release.version, CURRENT_VERSION)) {
          const platform = detectPlatform();
          const urlMap = { windows: release.win_url, mac: release.mac_url, linux: release.linux_url };
          setState({
            updateAvailable: true,
            release,
            platform,
            downloadUrl: urlMap[platform] || release.win_url || release.mac_url || release.linux_url,
            dismissed: false,
          });
        }
      } catch {
        // Silently ignore — update check should never break the app
      }
    }
    // Check after a short delay so it doesn't block initial render
    const t = setTimeout(check, 3000);
    return () => { mounted = false; clearTimeout(t); };
  }, []);

  function dismiss() {
    setState(s => ({ ...s, dismissed: true }));
  }

  return { ...state, dismiss };
}

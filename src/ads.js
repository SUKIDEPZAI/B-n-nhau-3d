// Google AdSense H5 Games Ads (Ad Placement API). Không có publisherId => quảng cáo mô phỏng để thử luồng.
import { ADS } from './config.js';

let ready = false, loading = null, lastInter = 0, lastReward = 0, sdkFailed = false;
const real = () => !!ADS.publisherId;

function load() {
  if (loading) return loading;
  loading = new Promise((res) => {
    if (!real()) return res(false);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = (o) => window.adsbygoogle.push(o);
    const s = document.createElement('script');
    s.async = true; s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADS.publisherId);
    s.setAttribute('data-ad-client', ADS.publisherId);
    if (ADS.testMode) s.setAttribute('data-adbreak-test', 'on');
    s.onerror = () => { sdkFailed = true; res(false); };
    document.head.appendChild(s);
    window.adConfig({ preloadAdBreaks: 'on', sound: 'on', onReady: () => { ready = true; res(true); } });
    setTimeout(() => res(ready), 4000);
  });
  return loading;
}
export function initAds() { load(); }
export function adsMode() { return real() ? (sdkFailed ? 'blocked' : 'real') : 'sim'; }
export function rewardWait() { return Math.max(0, ADS.rewardCooldownMs - (Date.now() - lastReward)); }

/** Mô phỏng: lớp phủ đếm ngược, nút đóng sau khi xong. */
function simAd(ui) {
  return new Promise((res) => {
    const el = document.getElementById('adsim'); el.classList.remove('hide');
    const t = document.getElementById('adsimT'), b = document.getElementById('adsimX'); let n = 5; b.disabled = true; b.textContent = 'Đang xem…';
    t.textContent = n; ui?.before?.();
    const iv = setInterval(() => { n--; t.textContent = n; if (n <= 0) { clearInterval(iv); b.disabled = false; b.textContent = 'Nhận thưởng'; } }, 1000);
    b.onclick = () => { if (n > 0) return; el.classList.add('hide'); ui?.after?.(); res('viewed'); };
    document.getElementById('adsimS').onclick = () => { clearInterval(iv); el.classList.add('hide'); ui?.after?.(); res('dismissed'); };
  });
}

/** Quảng cáo nhận thưởng. Trả về 'viewed' | 'dismissed' | 'unavailable' | 'cooldown'. */
export async function rewardedAd(name, hooks) {
  if (rewardWait() > 0) return 'cooldown';
  await load();
  let r;
  if (!real()) r = await simAd(hooks);
  else if (!ready) r = 'unavailable';
  else r = await new Promise((res) => {
    let done = false;
    window.adBreak({
      type: 'reward', name,
      beforeAd: () => hooks?.before?.(), afterAd: () => hooks?.after?.(),
      beforeReward: (showAdFn) => showAdFn(),
      adViewed: () => { done = true; res('viewed'); },
      adDismissed: () => { done = true; res('dismissed'); },
      adBreakDone: () => { if (!done) res('unavailable'); },
    });
  });
  if (r === 'viewed') lastReward = Date.now();
  return r;
}

/** Quảng cáo xen kẽ sau trận (chỉ khi cấu hình thật, và không quá dày). */
export async function interstitialAd(name, hooks) {
  if (!real() || Date.now() - lastInter < ADS.interstitialEveryMs) return;
  await load(); if (!ready) return;
  lastInter = Date.now();
  await new Promise((res) => window.adBreak({ type: 'next', name, beforeAd: () => hooks?.before?.(), afterAd: () => hooks?.after?.(), adBreakDone: () => res() }));
}

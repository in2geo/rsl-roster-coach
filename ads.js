// ── AdSense Rewarded Ad Manager ────────────────────────────────────────────
//
// AdSense rewarded ads work through the adsbygoogle push API.
// Replace AD_CLIENT and AD_SLOT with values from your AdSense dashboard
// (Ads → By ad unit → Rewarded interstitial).
//
// AdSense rewarded interstitials are the closest web equivalent to the
// native rewarded video format. The user sees an ad; on completion the
// granted() callback fires.
//
// Docs: https://support.google.com/adsense/answer/9261666

const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';  // ← replace with your AdSense publisher ID
const AD_SLOT   = 'XXXXXXXXXX';               // ← replace with your rewarded interstitial slot ID

let adLoaded    = false;
let currentAd   = null;

/**
 * Call once on page load (after the AdSense script is on the page).
 * Preloads a rewarded ad so it's ready when the user taps the button.
 */
export function preloadRewardedAd() {
  if (!window.adsbygoogle) return;

  window.adsbygoogle = window.adsbygoogle || [];

  (window.adsbygoogle).push({
    preloadAdBreaks: 'on',
  });

  (window.adsbygoogle).push({
    google_ad_client: AD_CLIENT,
  });

  adLoaded = true;
}

/**
 * Show a rewarded ad.
 * @returns Promise<boolean> — resolves true if the user earned the reward,
 *          false if they skipped or no ad was available.
 */
export function showRewardedAd() {
  return new Promise((resolve) => {
    if (!adLoaded || !window.adsbygoogle) {
      // No ad available — fail gracefully and give the user the reward anyway.
      // Change this to resolve(false) if you want to strictly gate on ad completion.
      console.warn('AdSense not loaded — granting reward without ad');
      resolve(true);
      return;
    }

    let rewarded = false;

    (window.adsbygoogle).push({
      params: {
        google_ad_client: AD_CLIENT,
        google_ad_slot:   AD_SLOT,
      },
      type: 'reward',
      // Called when the user earns the reward (watched enough of the ad)
      rewardedBreakReady(ad) {
        currentAd = ad;
        ad.showAdBreak();
      },
      // Called immediately when the ad break starts
      beforeAd() {
        rewarded = false;
      },
      // Called when the user completes the reward condition
      adBreakDone(info) {
        // info.breakStatus values: 'viewed' | 'dismissed' | 'not-ready' | 'timeout' | 'error'
        resolve(info.breakStatus === 'viewed');
      },
      // AdSense rewarded interstitial fires this when reward is granted
      rewardedBreakGranted() {
        rewarded = true;
      },
    });
  });
}

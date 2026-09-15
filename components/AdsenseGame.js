'use client';

import Script from 'next/script';

export default function AdsenseGame() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const test = process.env.NEXT_PUBLIC_ADSENSE_TEST === 'on';
  if (!client) return null;

  return (
    <Script
      id="adsense-h5-games"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      data-ad-client={client}
      data-adbreak-test={test ? 'on' : undefined}
      data-ad-frequency-hint="120s"
      strategy="afterInteractive"
      onLoad={() => {
        if (typeof window !== 'undefined') {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adBreak = window.adBreak || function (o) { window.adsbygoogle.push(o); };
          window.adConfig = window.adConfig || function (o) { window.adsbygoogle.push(o); };
          try {
            window.adConfig({ preloadAdBreaks: 'on', sound: 'on' });
          } catch (_) {}
        }
      }}
    />
  );
}

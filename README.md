# Drunken Legend — Next.js HTML5 Game

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Controls

### PC
- WASD / Arrow Keys: move
- Mouse: aim 360°
- Hold left mouse button or Space: fire
- 1 / 2 / 3: switch to pistol / AK-47 / RPG
- Esc: pause

### Mobile
- Virtual joystick: move
- Manual Fire setting: enables the FIRE button
- One-hand mode: keep both controls on the right

## Gameplay

- Power-ups: AK-47, RPG, +30 health
- Boss fights at waves/levels 5, 10, 15, 20 and 25
- Five boss types with different behaviors
- Boss health bar and simple dialogue messages
- Health at 0 ends the run
- Death screen includes a rewarded-ad revive path

## Google AdSense / H5 Games Ads

This project includes a configuration-ready H5 Games Ads integration. It intentionally does NOT include a real publisher ID.

1. Create/approve an AdSense account and add your live game domain to the AdSense Sites list.
2. Apply for access to AdSense H5 Games Ads (it is an application-based product; approval is not guaranteed).
3. Put your AdSense publisher ID in `.env.local`:

```env
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX
NEXT_PUBLIC_ADSENSE_TEST=on
```

4. For production, turn testing off:

```env
NEXT_PUBLIC_ADSENSE_TEST=
```

5. Replace `public/ads.txt` (or `ads.txt` at the site root if your hosting supports it) with the exact authorized seller line shown in your AdSense account.

The revive flow uses the H5 Games Ad Placement API's `reward` placement. The reward is only granted from the `adViewed` callback after the ad completes.

Important: do not reward ad clicks and do not promise cash/value outside the game. Keep the reward disclosure visible before the player opts in.

### What you still need to provide

- Your approved AdSense publisher ID (`ca-pub-...`)
- The final public domain where this Next.js game will be hosted
- H5 Games Ads access/approval from Google
- The exact ads.txt seller line from your AdSense account
- If you later wrap this H5 game inside an Android app, use AdMob for the app/WebView path rather than treating the website implementation as the mobile-app ad setup.

# Drunken Legend — Next.js Web Edition

A self-contained Next.js prototype inspired by the existing Drunken Legend mobile gameplay flow.

## Included
- Mobile-first arcade arena gameplay rendered with HTML Canvas
- Virtual joystick movement
- Auto-fire mode
- Manual fire mode with dedicated FIRE button
- One-hand mode that moves controls together to the lower-right
- Pause/resume overlay
- Settings panel for one-hand mode, manual fire and sound toggle
- Score, combo, HP, wave HUD
- Responsive layout for desktop and mobile browsers
- No external game engine required

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production

```bash
npm run build
npm start
```

The project uses the Next.js App Router and can be deployed to Vercel or another Node-compatible Next.js host.

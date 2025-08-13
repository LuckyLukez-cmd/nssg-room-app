
# NSSG Raumreservierung – v3 (Final, Vercel-ready)

## Farben & Schrift
- NSSG Yellow: #FFD521
- NSSG Black:  #1F1F1F
- Schrift: Camphor Std (Fallback aktiv; WOFF2 optional in /public/fonts)

## Schnellstart lokal
```bash
npm install
npm run dev
```

## Admin-Seeding (setzt Admin-Rollen & Level)
```bash
npm i firebase-admin
node scripts/seedAdmins.js
```
> nutzt `serviceAccountKey.json` im Projektwurzelverzeichnis (liegt bei). Bewahre diese Datei sicher auf.

## Deploy auf Vercel (manueller Upload oder Git)
- Build:
```bash
npm run build    # Output: dist/
```
- Vercel-Einstellungen:
  - Framework: Vite
  - Build Command: `npm run build`
  - Output Directory: `dist`
- SPA-Routes sind durch `vercel.json` korrekt konfiguriert.

## Domain
In Vercel Project → Settings → **Domains** → `reservierung.nssg.ch` hinzufügen und CNAME im DNS setzen.

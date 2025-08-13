
# NSSG Raumreservierung – v3 (Public for Vercel)

**Design**: nssg.yellow `#FFD521`, nssg.black `#1F1F1F` (siehe `tailwind.config.js`).  
**Keine Secrets im Repo** – `serviceAccountKey.json` ist in `.gitignore`.

## Lokale Nutzung
```bash
npm install
npm run dev
```

## Admin-Seeding (lokal, optional)
1. In Firebase Console -> Projekteinstellungen -> Dienstkonten -> neuen privaten Schlüssel generieren -> Datei als `serviceAccountKey.json` ins Projekt legen (nicht committen!).
2. Admins anlegen:
```bash
npm i firebase-admin
node scripts/seedAdmins.js
```

## Build & Vercel
```bash
npm run build   # erzeugt dist/
# Vercel: Framework "Vite", Build "npm run build", Output "dist"
```

## SPA Rewrites
`vercel.json` sorgt dafür, dass alle Routen auf `/index.html` zeigen.

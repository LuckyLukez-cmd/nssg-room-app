
// scripts/seedAdmins.js
// npm i firebase-admin
// Service Account Key: Speichert die Datei als serviceAccountKey.json im Projekt (nicht committen! .gitignore schützt).

const admin = require('firebase-admin');
let serviceAccount;
try {
  serviceAccount = require('../serviceAccountKey.json');
} catch (e) {
  console.error('Fehlt: serviceAccountKey.json – lade den privaten Firebase-Service-Account-Key ins Projektwurzelverzeichnis.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const ADMINS = [
  'lernassistenz@neue-stadtschulen.ch',
  'lucas.koerl@neue-stadtschulen.ch',
  'karin.gander@neue-stadtschulen.ch',
  'eric.garrity@neue-stadtschulen.ch',
  'davide.spezzacatena@neue-stadtschulen.ch',
  'michael.schweizer@neue-stadtschulen.ch',
  'philippe.grawehr@neue-stadtschulen.ch',
];

async function ensureUserByEmail(email) {
  let u;
  try { u = await auth.getUserByEmail(email); }
  catch {
    u = await auth.createUser({ email, password: 'NssgTemp123!', emailVerified: true, displayName: email.split('@')[0] });
    console.log('Auth user created:', email);
  }
  await db.doc(`users/${u.uid}`).set({
    email, role: 'admin', level: 'master',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

(async () => {
  for (const mail of ADMINS) await ensureUserByEmail(mail);
  console.log('✓ Admins gesetzt');
  process.exit(0);
})();

// scripts/seedAdmins.js
// Usage:
//   1) Place your Service Account JSON as serviceAccountKey.json in the project root
//   2) npm i firebase-admin
//   3) node scripts/seedAdmins.js
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json in project root.');
  process.exit(1);
}
const serviceAccount = require(keyPath);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const auth = admin.auth();

// Update this list if needed
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
    u = await auth.createUser({
      email, password: 'NssgTemp123!', emailVerified: true, displayName: email.split('@')[0],
    });
    console.log('Auth user created:', email);
  }
  await db.doc(`users/${u.uid}`).set({
    email,
    role: 'admin',
    level: 'master',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  // Optionally set custom claims:
  // await auth.setCustomUserClaims(u.uid, { role: 'admin' });
}

(async () => {
  for (const mail of ADMINS) await ensureUserByEmail(mail);
  console.log('✓ Admins set.');
  process.exit(0);
})();

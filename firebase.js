
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: "AIzaSyAfbJO_ySDVa0cOS3jrldRQP6JsbAJePm0",
  authDomain: "room-booking-nssg.firebaseapp.com",
  projectId: "room-booking-nssg",
  storageBucket: "room-booking-nssg.appspot.com",
  messagingSenderId: "75834176527",
  appId: "1:75834176527:web:e1b0c21f060afadfad477a",
  vapidKey: "BGxwZJn4PxuMgJb4ynSyrzfIcwohwKXrr_AV7lmGoURSEitE3LMqPG7qp4n1alJM0P1X-Aa0SkWm6pL9SvtAYHs"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export let messaging = undefined;
(async () => {
  try {
    if (await isSupported()) { messaging = getMessaging(app); }
  } catch {}
})();

export const config = firebaseConfig;

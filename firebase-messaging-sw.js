
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAfbJO_ySDVa0cOS3jrldRQP6JsbAJePm0",
  authDomain: "room-booking-nssg.firebaseapp.com",
  projectId: "room-booking-nssg",
  storageBucket: "room-booking-nssg.appspot.com",
  messagingSenderId: "75834176527",
  appId: "1:75834176527:web:e1b0c21f060afadfad477a"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage(({ notification }) => {
  self.registration.showNotification(notification.title, {
    body: notification.body,
    icon: '/icons/icon-192.png'
  });
});

// app.config.js – liest EXPO_PUBLIC_BACKEND_URL aus .env
//
// Lokal (Expo Go):       EXPO_PUBLIC_BACKEND_URL=http://192.168.1.xxx:8002
// Internet (Tunnel):     EXPO_PUBLIC_BACKEND_URL=https://inventarpro.example.com
// Web via Nginx:         EXPO_PUBLIC_BACKEND_URL=   (leer → relative URLs)

const appJson = require('./app.json');

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      // undefined → Fallback im Code greift; '' → relative URLs (Nginx-Betrieb)
      EXPO_PUBLIC_BACKEND_URL:
        backendUrl !== undefined ? backendUrl : 'http://localhost:8002',
    },
  },
};

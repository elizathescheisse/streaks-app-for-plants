// Firebase setup for the phone app. Same project as the web app (these values
// identify the project and are NOT secrets — Firestore security rules are what
// protect the data), so phone and web read and write the same garden.
import { initializeApp } from 'firebase/app'
import { initializeAuth, getReactNativePersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
  apiKey: 'AIzaSyDV17RI66SfFlS-rx9IcmFf6M9v0UN-DzI',
  authDomain: 'plants-app-f40e5.firebaseapp.com',
  projectId: 'plants-app-f40e5',
  storageBucket: 'plants-app-f40e5.firebasestorage.app',
  messagingSenderId: '478460097539',
  appId: '1:478460097539:web:96a35c59e96fa90a234a36',
}

const app = initializeApp(firebaseConfig)

// Persistence keeps you signed in between app launches.
export const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
export const db = getFirestore(app)

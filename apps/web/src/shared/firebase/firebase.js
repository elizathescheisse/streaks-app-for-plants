// Firebase setup for the web app. These values identify the project; they are
// NOT secrets (they ship in every visitor's browser by design). Access is
// enforced by Firestore security rules, not by hiding this config.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDV17RI66SfFlS-rx9IcmFf6M9v0UN-DzI',
  authDomain: 'plants-app-f40e5.firebaseapp.com',
  projectId: 'plants-app-f40e5',
  storageBucket: 'plants-app-f40e5.firebasestorage.app',
  messagingSenderId: '478460097539',
  appId: '1:478460097539:web:96a35c59e96fa90a234a36',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

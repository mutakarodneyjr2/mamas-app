import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDkZQ-sp3W8qwCXfadZRsGbEnUezQlInFs",
  authDomain: "mama-alumin.firebaseapp.com",
  projectId: "mama-alumin",
  storageBucket: "mama-alumin.firebasestorage.app",
  messagingSenderId: "396635962310",
  appId: "1:396635962310:web:ae5ba06ec3c60f6ade90c7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Try to sign in as mutakarodney2@gmail.com or something else to see if email/password is enabled
signInWithEmailAndPassword(auth, 'mutakarodney2@gmail.com', 'password123')
  .then((cred) => console.log("Logged in!", cred.user.uid))
  .catch((err) => console.error(err.code, err.message));

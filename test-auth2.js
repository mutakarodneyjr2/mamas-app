import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

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

createUserWithEmailAndPassword(auth, 'system@mamas.local', 'SuperSecretSystem123!')
  .then((cred) => console.log("Created!", cred.user.uid))
  .catch((err) => console.error(err.code, err.message));

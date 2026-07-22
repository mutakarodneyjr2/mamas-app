import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
const db = getFirestore(app);

signInWithEmailAndPassword(auth, 'system@mamas.local', 'SuperSecretSystem123!')
  .then(async (cred) => {
    console.log("Logged in!", cred.user.uid);
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      fullName: "System Admin",
      email: "system@mamas.local",
      role: "super_admin",
      status: "approved",
      createdAt: Date.now()
    });
    console.log("Created user doc!");
    process.exit(0);
  })
  .catch((err) => console.error(err.code, err.message));

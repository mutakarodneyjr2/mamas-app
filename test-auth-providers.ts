import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

initAdmin({ projectId: "mama-alumin" });

async function run() {
  try {
    const auth = getAdminAuth();
    // find user by phone number
    const user = await auth.getUserByPhoneNumber("+256700000000").catch(() => null);
    if (user) {
      console.log("User by phone:", user.uid, user.providerData);
    } else {
      console.log("User not found by phone");
    }
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();

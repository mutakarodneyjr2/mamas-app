import { initializeApp as initAdmin } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

initAdmin({ projectId: "mama-alumin" });

async function run() {
  try {
    const auth = getAdminAuth();
    const result = await auth.listUsers(10);
    for (const user of result.users) {
      console.log(`UID: ${user.uid}, Email: ${user.email}, Phone: ${user.phoneNumber}`);
      console.log(`Providers: ${JSON.stringify(user.providerData)}`);
      console.log("---");
    }
  } catch(e) {
    console.error("Failed:", e);
  }
}
run();

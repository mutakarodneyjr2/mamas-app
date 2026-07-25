sed -i '10d' src/pages/AdminUsers.tsx
sed -i '/const { currentUser, userProfile } = useAuth();/a \  const canApprove = ["super_admin", "secretary"].includes(userProfile?.role || "");' src/pages/AdminUsers.tsx

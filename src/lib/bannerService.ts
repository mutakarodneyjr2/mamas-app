import { collection, query, orderBy, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Banner } from '../types';

export const getBanners = async (): Promise<Banner[]> => {
  const bannersRef = collection(db, 'banners');
  const q = query(bannersRef, orderBy('order', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
};

export const getActiveBanners = async (): Promise<Banner[]> => {
  const banners = await getBanners();
  return banners.filter(b => b.isActive);
};

export const createBanner = async (banner: Omit<Banner, 'id'>): Promise<string> => {
  const newRef = doc(collection(db, 'banners'));
  await setDoc(newRef, {
    ...banner,
    createdAt: Date.now()
  });
  return newRef.id;
};

export const updateBanner = async (id: string, data: Partial<Banner>): Promise<void> => {
  const bannerRef = doc(db, 'banners', id);
  await updateDoc(bannerRef, data);
};

export const deleteBanner = async (id: string): Promise<void> => {
  const bannerRef = doc(db, 'banners', id);
  await deleteDoc(bannerRef);
};

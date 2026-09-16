import { collection, query, orderBy, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Banner } from '../types';

export const getBanners = async (): Promise<Banner[]> => {
  try {
    const bannersRef = collection(db, 'landingBanners');
    const q = query(bannersRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
    }
  } catch (err) {
    console.warn('Could not query landingBanners collection:', err);
  }

  try {
    const bannersRef = collection(db, 'banners');
    const q = query(bannersRef, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner));
    }
  } catch (err) {
    console.warn('Could not query banners collection:', err);
  }

  return [];
};

export const getActiveBanners = async (): Promise<Banner[]> => {
  const result: Banner[] = [];
  const urlsSeen = new Set<string>();

  // 1. Try landingBanners & banners collections
  const banners = await getBanners();
  for (const b of banners) {
    if (b.isActive !== false && b.url && !urlsSeen.has(b.url)) {
      urlsSeen.add(b.url);
      result.push(b);
    }
  }

  // 2. Try appSettings/main banners
  try {
    const settingsDoc = await getDoc(doc(db, 'appSettings', 'main'));
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      const list: string[] = data.banners || data.landingBanners || [];
      list.forEach((url, idx) => {
        if (url && !urlsSeen.has(url)) {
          urlsSeen.add(url);
          result.push({
            id: `settings_banner_${idx}`,
            url,
            isActive: true,
            order: idx,
            createdAt: Date.now()
          });
        }
      });
    }
  } catch (err) {
    console.warn('Could not read appSettings for banners:', err);
  }

  return result;
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

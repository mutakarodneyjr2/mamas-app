import { collection, query, orderBy, getDocs, doc, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
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
  const docId = doc(collection(db, 'landingBanners')).id;
  
  await setDoc(doc(db, 'landingBanners', docId), {
    ...banner,
    createdAt: Date.now()
  });

  try {
    await setDoc(doc(db, 'banners', docId), {
      ...banner,
      createdAt: Date.now()
    });
  } catch (e) {
    console.warn("Could not save to secondary banners collection:", e);
  }

  return docId;
};

export const updateBanner = async (id: string, data: Partial<Banner>): Promise<void> => {
  try {
    await updateDoc(doc(db, 'landingBanners', id), data);
  } catch (e) {
    console.warn(e);
  }
  try {
    await updateDoc(doc(db, 'banners', id), data);
  } catch (e) {
    console.warn(e);
  }
};

export const deleteBanner = async (id: string): Promise<void> => {
  let imageUrl = '';
  try {
    const landingDoc = await getDoc(doc(db, 'landingBanners', id));
    if (landingDoc.exists()) {
      imageUrl = landingDoc.data().imageUrl || landingDoc.data().image || '';
    } else {
      const bannerDoc = await getDoc(doc(db, 'banners', id));
      if (bannerDoc.exists()) {
        imageUrl = bannerDoc.data().imageUrl || bannerDoc.data().image || '';
      }
    }
  } catch (e) {
    console.warn("Could not read banner doc before deletion:", e);
  }

  if (imageUrl) {
    try {
      const bannerRef = ref(storage, imageUrl);
      await deleteObject(bannerRef);
    } catch (e) {
      console.warn("Could not delete banner image from storage (it may not exist or not be a storage URL):", e);
    }
  }

  try {
    await deleteDoc(doc(db, 'landingBanners', id));
  } catch (e) {
    console.warn("Could not delete from landingBanners:", e);
  }
  try {
    await deleteDoc(doc(db, 'banners', id));
  } catch (e) {
    console.warn("Could not delete from banners:", e);
  }
};

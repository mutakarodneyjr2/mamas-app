import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import imageCompression from 'browser-image-compression';

export const uploadImage = async (file: File, path: string): Promise<string> => {
  // Compress image
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };
  
  try {
    const compressedFile = await imageCompression(file, options);
    const storageRef = ref(storage, path);
    
    // Upload file
    const uploadTask = await uploadBytesResumable(storageRef, compressedFile);
    
    // Get download URL
    const downloadURL = await getDownloadURL(uploadTask.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image. Please try again.');
  }
};

export const deleteImage = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    // Ignore error if object doesn't exist
  }
};

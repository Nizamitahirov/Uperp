import { getDownloadURL, ref, uploadBytes, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './config';

/** Fayl yükləyir və download URL qaytarır (10 §10.2) */
export async function uploadFile(path: string, file: File): Promise<string> {
  const storage = getFirebaseStorage();
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fileRef = ref(storage, `${path}/${safeName}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/** URL-dən faylı silir (storage path-i URL-dən çıxarır) */
export async function deleteFileByUrl(url: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const fileRef = ref(storage, url);
    await deleteObject(fileRef);
  } catch {
    /* mövcud deyilsə ötür */
  }
}

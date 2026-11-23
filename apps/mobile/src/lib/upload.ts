import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import { api, ApiError } from './api';

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
  webFile?: globalThis.File;
}

const MAX_BYTES = 10 * 1024 * 1024;

export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const a = result.assets[0];
  if (a.size && a.size > MAX_BYTES) throw new ApiError(400, 'File is larger than 10 MB');
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/pdf', webFile: a.file };
}

/** Presign → PUT straight to storage. Returns the object key to attach to a record. */
export async function uploadFile(
  file: PickedFile,
  purpose: 'application-document' | 'maintenance-photo' | 'residence-photo',
): Promise<string> {
  const { key, uploadUrl } = await api.post<{ key: string; uploadUrl: string }>('/uploads/presign', {
    purpose,
    fileName: file.name,
    contentType: file.mimeType,
  });

  const body = Platform.OS === 'web' && file.webFile ? file.webFile : new File(file.uri);
  // Content-Type must match what the URL was signed with.
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'content-type': file.mimeType }, body });
  if (!res.ok) throw new ApiError(res.status, 'Upload failed. Please try again.');
  return key;
}

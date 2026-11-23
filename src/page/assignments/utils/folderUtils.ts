export const stripUndefined = <T extends Record<string, unknown>>(data: T): Partial<T> => {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as Partial<T>;
};

// Pure folder and path helper functions extracted from src/page/AssignmentsManagementPage.tsx
import type { AssignmentFolderMeta } from '../../../services/firebaseService';

export const mergeFoldersByPath = (a: AssignmentFolderMeta[], b: AssignmentFolderMeta[]) => {
  const map = new Map<string, AssignmentFolderMeta>();
  [...a, ...b].forEach((f) => {
    if (!f?.path) return;
    const existing = map.get(f.path);
    map.set(f.path, existing ? { ...existing, ...f } : f);
  });
  return Array.from(map.values());
};

export const getPathParts = (path: string): string[] => String(path || '').split('/').filter(Boolean);
export const getParentPath = (path: string): string => {
  const parts = getPathParts(path);
  parts.pop();
  return parts.join('/');
};
export const getPathLastName = (path: string): string => {
  const parts = getPathParts(path);
  return parts[parts.length - 1] || '';
};

/**
 * Filters out a target folder path and all subfolders/files belonging to it
 */
export const filterOutFolderAndDescendants = <T extends { path?: string; folderPath?: string }>(
  items: T[],
  folderPath: string
): T[] => {
  if (!folderPath || !Array.isArray(items)) return items || [];
  return items.filter((item) => {
    const itemPath = String(item.path || item.folderPath || '');
    return !(itemPath === folderPath || itemPath.startsWith(`${folderPath}/`));
  });
};

// Pure folder and path helper functions extracted from src/page/AssignmentsManagementPage.tsx
import { AssignmentFolderMeta } from '../../../services/firebaseService';

export const mergeFoldersByPath = (a: AssignmentFolderMeta[], b: AssignmentFolderMeta[]) => {
  const map = new Map<string, AssignmentFolderMeta>();
  [...a, ...b].forEach((f) => {
    if (!f?.path) return;
    map.set(f.path, f);
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

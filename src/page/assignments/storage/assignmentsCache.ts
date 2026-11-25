// LocalStorage cache helpers extracted from src/page/AssignmentsManagementPage.tsx
import type { TrackKey, AssignmentFolderMeta } from '../../../services/firebaseService';
import { TRACK_FOLDERS_CACHE_KEY, UNIFIED130_FOLDERS_CACHE_KEY } from '../constants/assignments.constants.ts';

export const readCachedTrackFolders = (): Record<TrackKey, AssignmentFolderMeta[]> => {
  try {
    const raw = localStorage.getItem(TRACK_FOLDERS_CACHE_KEY);
    if (!raw) return { track1: [], track2: [], track3: [] };
    const parsed = JSON.parse(raw) as Record<TrackKey, AssignmentFolderMeta[]>;
    return {
      track1: Array.isArray(parsed?.track1) ? parsed.track1 : [],
      track2: Array.isArray(parsed?.track2) ? parsed.track2 : [],
      track3: Array.isArray(parsed?.track3) ? parsed.track3 : []
    };
  } catch {
    return { track1: [], track2: [], track3: [] };
  }
};

export const writeCachedTrackFolders = (folders: Record<TrackKey, AssignmentFolderMeta[]>) => {
  try {
    localStorage.setItem(TRACK_FOLDERS_CACHE_KEY, JSON.stringify(folders));
  } catch {
    // ignore localStorage quota/private mode
  }
};

export const readCachedUnified130Folders = (): AssignmentFolderMeta[] => {
  try {
    const raw = localStorage.getItem(UNIFIED130_FOLDERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssignmentFolderMeta[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writeCachedUnified130Folders = (folders: AssignmentFolderMeta[]) => {
  try {
    localStorage.setItem(UNIFIED130_FOLDERS_CACHE_KEY, JSON.stringify(folders));
  } catch {
    // ignore localStorage quota/private mode
  }
};

export const removeCachedTrackFolders = (track: TrackKey, folderPaths: string[]) => {
  if (!folderPaths || folderPaths.length === 0) return;
  const current = readCachedTrackFolders();
  const updatedTrackFolders = (current[track] || []).filter((f) => {
    const p = f.path || '';
    return !folderPaths.some((target) => p === target || p.startsWith(`${target}/`));
  });
  writeCachedTrackFolders({
    ...current,
    [track]: updatedTrackFolders,
  });
};

export const removeCachedUnified130Folders = (folderPaths: string[]) => {
  if (!folderPaths || folderPaths.length === 0) return;
  const current = readCachedUnified130Folders();
  const updated = current.filter((f) => {
    const p = f.path || '';
    return !folderPaths.some((target) => p === target || p.startsWith(`${target}/`));
  });
  writeCachedUnified130Folders(updated);
};

export const renameCachedTrackFolder = (
  track: TrackKey,
  oldPath: string,
  newPath: string,
  newName: string
) => {
  const current = readCachedTrackFolders();
  const list = current[track] || [];
  const oldPrefix = `${oldPath}/`;
  const updated = list.map((f) => {
    const p = f.path || '';
    if (p === oldPath) {
      return { ...f, name: newName, path: newPath };
    }
    if (p.startsWith(oldPrefix)) {
      const childNewPath = `${newPath}/${p.slice(oldPrefix.length)}`;
      const childParent = f.parentPath || '';
      const childNewParent = childParent === oldPath
        ? newPath
        : (childParent.startsWith(oldPrefix) ? `${newPath}/${childParent.slice(oldPrefix.length)}` : childParent);
      return { ...f, path: childNewPath, parentPath: childNewParent };
    }
    return f;
  });
  writeCachedTrackFolders({
    ...current,
    [track]: updated,
  });
};

export const renameCachedUnified130Folder = (
  oldPath: string,
  newPath: string,
  newName: string
) => {
  const current = readCachedUnified130Folders();
  const oldPrefix = `${oldPath}/`;
  const updated = current.map((f) => {
    const p = f.path || '';
    if (p === oldPath) {
      return { ...f, name: newName, path: newPath };
    }
    if (p.startsWith(oldPrefix)) {
      const childNewPath = `${newPath}/${p.slice(oldPrefix.length)}`;
      const childParent = f.parentPath || '';
      const childNewParent = childParent === oldPath
        ? newPath
        : (childParent.startsWith(oldPrefix) ? `${newPath}/${childParent.slice(oldPrefix.length)}` : childParent);
      return { ...f, path: childNewPath, parentPath: childNewParent };
    }
    return f;
  });
  writeCachedUnified130Folders(updated);
};

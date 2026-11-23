import type { AssignmentFolderMeta } from '../../../services/firebaseService.ts';

export interface AggregateFolderCounts {
  subfoldersCount: number;
  totalFilesCount: number;
  isParent: boolean;
}

export interface BreadcrumbSegment {
  name: string;
  path: string;
  folderId?: string;
}

export const getVisibleFoldersAtLevel = (
  allFolders: AssignmentFolderMeta[],
  currentPath: string,
  activeFolderId?: string | null
): AssignmentFolderMeta[] => {
  if (!allFolders || allFolders.length === 0) return [];
  const cleanPath = (currentPath || '').trim().replace(/^\/+|\/+$/g, '');

  if (!cleanPath && !activeFolderId) {
    return allFolders.filter((f) => {
      const fParent = (f.parentPath || '').trim().replace(/^\/+|\/+$/g, '');
      const fPath = (f.path || '').trim().replace(/^\/+|\/+$/g, '');
      if (f.parentFolderId) return false;
      if (fParent) return false;
      return !fPath.includes('/');
    });
  }

  const parentFolder = activeFolderId
    ? allFolders.find((f) => f.id === activeFolderId)
    : allFolders.find((f) => (f.path || '').trim().replace(/^\/+|\/+$/g, '') === cleanPath);

  const resolvedParentId = activeFolderId || parentFolder?.id;

  return allFolders.filter((f) => {
    if (resolvedParentId && f.parentFolderId === resolvedParentId) return true;
    const fParent = (f.parentPath || '').trim().replace(/^\/+|\/+$/g, '');
    if (cleanPath && fParent === cleanPath) return true;
    const fPath = (f.path || '').trim().replace(/^\/+|\/+$/g, '');
    if (cleanPath && fPath.startsWith(`${cleanPath}/`)) {
      const sub = fPath.slice(cleanPath.length + 1);
      return !sub.includes('/');
    }
    return false;
  });
};

export const computeAggregateFolderCounts = (
  targetFolder: AssignmentFolderMeta,
  allFolders: AssignmentFolderMeta[],
  allFiles: Array<{ id: string; folderPath?: string; folder?: string }>
): AggregateFolderCounts => {
  const targetPath = (targetFolder.path || '').trim().replace(/^\/+|\/+$/g, '');
  const targetPathPrefix = `${targetPath}/`;

  const directChildren = allFolders.filter((f) => {
    if (targetFolder.id && f.parentFolderId === targetFolder.id) return true;
    const fParent = (f.parentPath || '').trim().replace(/^\/+|\/+$/g, '');
    if (targetPath && fParent === targetPath) return true;
    const fPath = (f.path || '').trim().replace(/^\/+|\/+$/g, '');
    if (targetPath && fPath.startsWith(targetPathPrefix)) {
      const sub = fPath.slice(targetPath.length + 1);
      return !sub.includes('/');
    }
    return false;
  });

  const isParent = Boolean(
    targetFolder.isParentFolder ||
    directChildren.length > 0 ||
    (typeof targetFolder.subfoldersCount === 'number' && targetFolder.subfoldersCount > 0)
  );

  const matchingFiles = allFiles.filter((f) => {
    const fp = String(f.folderPath || f.folder || '').trim().replace(/^\/+|\/+$/g, '');
    return fp === targetPath || fp.startsWith(targetPathPrefix);
  });

  const subfoldersCount = Math.max(
    directChildren.length,
    typeof targetFolder.subfoldersCount === 'number' ? targetFolder.subfoldersCount : 0
  );

  const totalFilesCount = Math.max(
    matchingFiles.length,
    typeof targetFolder.totalFilesCount === 'number' ? targetFolder.totalFilesCount : 0
  );

  return {
    subfoldersCount,
    totalFilesCount,
    isParent,
  };
};

export const buildBreadcrumbTrail = (
  currentPath: string,
  allFolders: AssignmentFolderMeta[],
  rootLabel: string = 'المسار الرئيسي'
): BreadcrumbSegment[] => {
  const trail: BreadcrumbSegment[] = [{ name: rootLabel, path: '' }];
  if (!currentPath) return trail;

  const parts = currentPath.split('/').filter(Boolean);
  let accumulated = '';

  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    const matchedFolder = allFolders.find((f) => f.path === accumulated);
    trail.push({
      name: matchedFolder?.name || part,
      path: accumulated,
      folderId: matchedFolder?.id,
    });
  }

  return trail;
};

export const collectAllDescendantFileIds = (
  folderPath: string,
  allFiles: Array<{ id: string; folderPath?: string; folder?: string }>
): string[] => {
  const target = String(folderPath || '').trim().replace(/^\/+|\/+$/g, '');
  if (!target) return [];
  const prefix = `${target}/`;

  return allFiles
    .filter((f) => {
      const fp = String(f.folderPath || f.folder || '').trim().replace(/^\/+|\/+$/g, '');
      return fp === target || fp.startsWith(prefix);
    })
    .map((f) => f.id);
};

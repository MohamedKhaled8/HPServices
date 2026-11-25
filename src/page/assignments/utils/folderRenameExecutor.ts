import type { AssignmentFolderMeta } from '../../../services/firebaseService';

export interface FolderRenameValidationResult {
  isValid: boolean;
  error?: string;
  cleanName: string;
}

export const validateFolderName = (
  name: string,
  currentFolder: AssignmentFolderMeta,
  siblingFolders: AssignmentFolderMeta[]
): FolderRenameValidationResult => {
  const cleanName = (name || '').trim();
  if (!cleanName) {
    return { isValid: false, error: 'اسم المجلد لا يمكن أن يكون فارغاً', cleanName: '' };
  }
  if (cleanName.includes('/') || cleanName.includes('\\')) {
    return { isValid: false, error: 'اسم المجلد لا يمكن أن يحتوي على رموز مسارات (/ أو \\)', cleanName };
  }
  if (cleanName === currentFolder.name.trim()) {
    return { isValid: false, error: 'لم يتم تغيير اسم المجلد', cleanName };
  }
  const currentParent = (currentFolder.parentPath || '').trim();
  const isDuplicate = siblingFolders.some((f) => {
    if (f.id === currentFolder.id) return false;
    const p = (f.parentPath || '').trim();
    return p === currentParent && f.name.trim().toLowerCase() === cleanName.toLowerCase();
  });
  if (isDuplicate) {
    return { isValid: false, error: 'يوجد مجلد آخر بنفس الاسم في نفس المسار', cleanName };
  }
  return { isValid: true, cleanName };
};

export const computeRenamedPath = (newName: string, parentPath?: string): string => {
  const p = (parentPath || '').trim();
  return p ? `${p}/${newName}` : newName;
};

export const transformDescendantPath = (childPath: string, oldPath: string, newPath: string): string => {
  const prefix = `${oldPath}/`;
  if (childPath === oldPath) return newPath;
  if (childPath.startsWith(prefix)) {
    return `${newPath}/${childPath.slice(prefix.length)}`;
  }
  return childPath;
};

export const transformDescendantParentPath = (childParentPath: string, oldPath: string, newPath: string): string => {
  const prefix = `${oldPath}/`;
  if (childParentPath === oldPath) return newPath;
  if (childParentPath.startsWith(prefix)) {
    return `${newPath}/${childParentPath.slice(prefix.length)}`;
  }
  return childParentPath;
};

export interface ResolvedRenameTargets<TFile> {
  targetFolder: AssignmentFolderMeta;
  descendantFolders: AssignmentFolderMeta[];
  directFiles: TFile[];
  nestedFiles: TFile[];
  affectedFiles: TFile[];
}

export const resolveRenameTargets = <TFile extends { id: string; folderPath?: string; folderName?: string; folder?: string }>(
  targetFolder: AssignmentFolderMeta,
  allFolders: AssignmentFolderMeta[],
  allFiles: TFile[]
): ResolvedRenameTargets<TFile> => {
  const oldPath = (targetFolder.path || '').trim();
  const prefix = `${oldPath}/`;

  const descendantFolders = allFolders.filter((f) => f.id !== targetFolder.id && (f.path || '').startsWith(prefix));
  const directFiles = allFiles.filter((f) => (f.folderPath || '').trim() === oldPath);
  const nestedFiles = allFiles.filter((f) => (f.folderPath || '').trim().startsWith(prefix));
  const affectedFiles = [...directFiles, ...nestedFiles];

  return { targetFolder, descendantFolders, directFiles, nestedFiles, affectedFiles };
};

export interface CascadeStateParams<
  TFolder extends AssignmentFolderMeta,
  TFile extends { id: string; folderPath?: string; folderName?: string; folder?: string }
> {
  oldPath: string;
  newPath: string;
  newName: string;
  folders: TFolder[];
  files: TFile[];
  selectedFolderPaths?: Set<string>;
  currentPath?: string;
}

export const cascadeFolderRenameState = <
  TFolder extends AssignmentFolderMeta,
  TFile extends { id: string; folderPath?: string; folderName?: string; folder?: string }
>({
  oldPath,
  newPath,
  newName,
  folders,
  files,
  selectedFolderPaths,
  currentPath,
}: CascadeStateParams<TFolder, TFile>) => {
  const prefix = `${oldPath}/`;

  const updatedFolders = folders.map((f) => {
    const p = f.path || '';
    if (p === oldPath) {
      return { ...f, name: newName, path: newPath };
    }
    if (p.startsWith(prefix)) {
      return {
        ...f,
        path: transformDescendantPath(p, oldPath, newPath),
        parentPath: transformDescendantParentPath(f.parentPath || '', oldPath, newPath),
      };
    }
    return f;
  });

  const updatedFiles = files.map((file) => {
    const fp = (file.folderPath || '').trim();
    if (fp === oldPath) {
      return {
        ...file,
        folderPath: newPath,
        folder: newPath,
        folderName: newName,
      };
    }
    if (fp.startsWith(prefix)) {
      const nextFp = transformDescendantPath(fp, oldPath, newPath);
      return {
        ...file,
        folderPath: nextFp,
        folder: nextFp,
      };
    }
    return file;
  });

  let updatedSelectedFolderPaths: Set<string> | undefined;
  if (selectedFolderPaths) {
    updatedSelectedFolderPaths = new Set<string>();
    selectedFolderPaths.forEach((path) => {
      if (path === oldPath) {
        updatedSelectedFolderPaths!.add(newPath);
      } else if (path.startsWith(prefix)) {
        updatedSelectedFolderPaths!.add(transformDescendantPath(path, oldPath, newPath));
      } else {
        updatedSelectedFolderPaths!.add(path);
      }
    });
  }

  let updatedCurrentPath = currentPath;
  if (currentPath !== undefined) {
    if (currentPath === oldPath) {
      updatedCurrentPath = newPath;
    } else if (currentPath.startsWith(prefix)) {
      updatedCurrentPath = transformDescendantPath(currentPath, oldPath, newPath);
    }
  }

  return {
    updatedFolders,
    updatedFiles,
    updatedSelectedFolderPaths,
    updatedCurrentPath,
  };
};

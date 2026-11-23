import { isSupportedAssignmentFile } from './folderUploadUtils.ts';

export interface FolderUploadGroup {
  folderName: string;
  files: File[];
}

export interface HierarchyParseResult {
  mode: 'single' | 'nested';
  groups: FolderUploadGroup[];
  excludedCount: number;
  rootFolderName?: string;
}

const sanitizeFolderName = (name: string): string =>
  name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';

export const parseFolderHierarchy = (rawFiles: File[]): HierarchyParseResult => {
  if (!rawFiles || rawFiles.length === 0) {
    return { mode: 'single', groups: [], excludedCount: 0 };
  }

  const validFiles: File[] = [];
  let excludedCount = 0;

  for (const file of rawFiles) {
    if (isSupportedAssignmentFile(file)) {
      validFiles.push(file);
    } else {
      const name = (file.name || '').toLowerCase().trim();
      if (!name.startsWith('.') && name !== 'thumbs.db' && name !== 'desktop.ini') {
        excludedCount++;
      }
    }
  }

  if (validFiles.length === 0) {
    return { mode: 'single', groups: [], excludedCount };
  }

  const parsedItems = validFiles.map((file) => {
    const relPath = ((file as { webkitRelativePath?: string }).webkitRelativePath || '').trim();
    const segments = relPath ? relPath.split('/').filter(Boolean) : [];
    return { file, segments };
  });

  const hasNestedSubfolders = parsedItems.some((item) => item.segments.length >= 3);

  if (!hasNestedSubfolders) {
    const fallbackTop = parsedItems[0]?.segments[0]
      ? sanitizeFolderName(parsedItems[0].segments[0])
      : sanitizeFolderName(validFiles[0]?.name.replace(/\.[^/.]+$/, '') || 'مجلد جديد');
    return {
      mode: 'single',
      groups: [{ folderName: fallbackTop, files: validFiles }],
      excludedCount,
      rootFolderName: fallbackTop,
    };
  }

  const rootFolderName = sanitizeFolderName(parsedItems[0]?.segments[0] || 'مجلد جديد');
  const groupMap = new Map<string, File[]>();

  for (const item of parsedItems) {
    const { file, segments } = item;
    let targetGroupName: string;

    if (segments.length >= 3) {
      targetGroupName = sanitizeFolderName(segments[1]);
    } else if (segments.length === 2) {
      targetGroupName = sanitizeFolderName(segments[0]);
    } else {
      targetGroupName = sanitizeFolderName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const existing = groupMap.get(targetGroupName);
    if (existing) {
      existing.push(file);
    } else {
      groupMap.set(targetGroupName, [file]);
    }
  }

  const groups: FolderUploadGroup[] = Array.from(groupMap.entries()).map(
    ([folderName, files]) => ({
      folderName,
      files,
    })
  );

  return {
    mode: 'nested',
    groups,
    excludedCount,
    rootFolderName,
  };
};

export const readAllDirectoryEntries = async (
  reader: { readEntries: (cb: (entries: any[]) => void, errCb?: (err: any) => void) => void }
): Promise<any[]> => {
  const allEntries: any[] = [];
  while (true) {
    const batch: any[] = await new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (!batch || batch.length === 0) break;
    allEntries.push(...batch);
  }
  return allEntries;
};

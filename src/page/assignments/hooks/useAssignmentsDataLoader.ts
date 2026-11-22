import { useEffect } from 'react';
import {
  getAssignmentFilesForTrack,
  getAssignmentFoldersForTrack,
  get130UnifiedFiles,
  get130UnifiedFolders,
  TrackKey,
  AssignmentFolderMeta,
} from '../../../services/firebaseService';
import { mergeFoldersByPath } from '../utils/folderUtils';
import {
  readCachedTrackFolders,
  writeCachedTrackFolders,
  readCachedUnified130Folders,
  writeCachedUnified130Folders,
} from '../storage/assignmentsCache';

interface UseAssignmentsDataLoaderOptions {
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setTrackFolders: React.Dispatch<React.SetStateAction<Record<TrackKey, AssignmentFolderMeta[]>>>;
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setUnified130Folders: React.Dispatch<React.SetStateAction<AssignmentFolderMeta[]>>;
}

export const useAssignmentsDataLoader = ({
  setTrackFiles,
  setTrackFolders,
  setUnified130Files,
  setUnified130Folders,
}: UseAssignmentsDataLoaderOptions) => {
  useEffect(() => {
    const loadAllTracks = async () => {
      try {
        const [f1, f2, f3, d1, d2, d3] = await Promise.all([
          getAssignmentFilesForTrack('track1'),
          getAssignmentFilesForTrack('track2'),
          getAssignmentFilesForTrack('track3'),
          getAssignmentFoldersForTrack('track1'),
          getAssignmentFoldersForTrack('track2'),
          getAssignmentFoldersForTrack('track3'),
        ]);
        setTrackFiles({ track1: f1, track2: f2, track3: f3 });
        const cached = readCachedTrackFolders();
        const merged = {
          track1: mergeFoldersByPath(d1, cached.track1),
          track2: mergeFoldersByPath(d2, cached.track2),
          track3: mergeFoldersByPath(d3, cached.track3),
        };
        setTrackFolders(merged);
        writeCachedTrackFolders(merged);
      } catch {
        setTrackFolders(readCachedTrackFolders());
      }
    };
    loadAllTracks();
  }, [setTrackFiles, setTrackFolders]);

  useEffect(() => {
    const load130Files = async () => {
      try {
        const [files, folders] = await Promise.all([get130UnifiedFiles(), get130UnifiedFolders()]);
        setUnified130Files(files);
        const cached = readCachedUnified130Folders();
        const merged = mergeFoldersByPath(folders, cached);
        setUnified130Folders(merged);
        writeCachedUnified130Folders(merged);
      } catch {
        setUnified130Folders(readCachedUnified130Folders());
      }
    };
    load130Files();
  }, [setUnified130Files, setUnified130Folders]);
};

export interface FolderCardFile {
  id?: string;
  name?: string;
  size?: number;
  url?: string;
  type?: string;
  folderPath?: string;
}

export interface FolderCardProps {
  title: string;
  count: number;
  files?: FolderCardFile[];
  onClick?: () => void;
  onFileUpload?: (files: File[]) => void;
  className?: string;
  showAddButton?: boolean;
}

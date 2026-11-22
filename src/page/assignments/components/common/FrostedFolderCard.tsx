import React from 'react';
import { FolderCard } from './FolderCard';
import { FolderCardProps } from './FolderCardTypes';

export type FrostedFolderCardProps = FolderCardProps;

export const FrostedFolderCard: React.FC<FolderCardProps> = (props) => {
  return <FolderCard {...props} />;
};

export default FrostedFolderCard;

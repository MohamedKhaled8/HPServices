export type MessagePlacement = 'top' | 'bottom' | 'left' | 'right';
export type MorphingSquareSize = 'sm' | 'md' | 'lg';

export interface MorphingSquareProps {
  message?: string;
  messagePlacement?: MessagePlacement;
  size?: MorphingSquareSize;
  className?: string;
}

export interface LoadingDotsProps {
  text?: string;
  className?: string;
  fullScreen?: boolean;
  size?: MorphingSquareSize;
}

export interface SizeDimensions {
  width: number;
  height: number;
  className: string;
}

export const DEFAULT_PLACEMENT: MessagePlacement = 'bottom';
export const DEFAULT_SIZE: MorphingSquareSize = 'md';
export const DEFAULT_ARIA_LABEL = 'جاري التحميل';

export const PLACEMENT_CLASSES: Record<MessagePlacement, string> = {
  bottom: 'hp-morph-placement-bottom flex-col',
  top: 'hp-morph-placement-top flex-col-reverse',
  right: 'hp-morph-placement-right flex-row',
  left: 'hp-morph-placement-left flex-row-reverse'
};

export const SIZE_DIMENSIONS: Record<MorphingSquareSize, SizeDimensions> = {
  sm: { width: 20, height: 20, className: 'hp-morph-size-sm' },
  md: { width: 40, height: 40, className: 'hp-morph-size-md' },
  lg: { width: 48, height: 48, className: 'hp-morph-size-lg' }
};

export function getPlacementClass(placement: MessagePlacement = DEFAULT_PLACEMENT): string {
  return PLACEMENT_CLASSES[placement] || PLACEMENT_CLASSES[DEFAULT_PLACEMENT];
}

export function getSizeClass(size: MorphingSquareSize = DEFAULT_SIZE): string {
  return (SIZE_DIMENSIONS[size] || SIZE_DIMENSIONS[DEFAULT_SIZE]).className;
}

export function getSizeDimensions(size: MorphingSquareSize = DEFAULT_SIZE): SizeDimensions {
  return SIZE_DIMENSIONS[size] || SIZE_DIMENSIONS[DEFAULT_SIZE];
}

export function getAriaLabel(message?: string): string {
  return message && message.trim().length > 0 ? message.trim() : DEFAULT_ARIA_LABEL;
}

export function mapLoadingDotsToProps(props: LoadingDotsProps): MorphingSquareProps {
  return {
    message: props.text,
    size: props.size || DEFAULT_SIZE,
    className: props.className || ''
  };
}

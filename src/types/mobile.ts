export interface BottomNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  isFab?: boolean;
}

export interface CardListProps<T> {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  emptyMessage?: string;
}

export interface FilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: () => void;
  onReset: () => void;
  children: React.ReactNode;
}

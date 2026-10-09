export interface DataTableProps<T> {
  columns: { key: string; label: string; render?: (row: T) => React.ReactNode }[];
  data: T[];
  page: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  density?: "compact" | "normal" | "comfortable";
}

export interface SidebarNavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  children?: SidebarNavItem[];
}

export interface FilterToolbarProps {
  onSearch: () => void;
  onReset: () => void;
  onRefresh: () => void;
  children: React.ReactNode;
}

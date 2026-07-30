import { EmptyState, ErrorState, LoadingState } from './states';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortKey?: string;
  width?: string;
}

export interface SortState {
  sortBy: string;
  sortDir: 'asc' | 'desc';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  sort?: SortState;
  onSortChange?: (sortBy: string) => void;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  sort,
  onSortChange,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingState />;
  }
  if (error) {
    return <ErrorState description={error} onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="nx-table-wrapper nx-scrollbar">
      <table className="nx-table">
        <thead>
          <tr>
            {columns.map((column) => {
              const isSortable = Boolean(column.sortKey && onSortChange);
              const isActive = sort?.sortBy === column.sortKey;
              return (
                <th
                  key={column.key}
                  style={{ width: column.width }}
                  className={isSortable ? 'sortable' : undefined}
                  onClick={
                    isSortable
                      ? () => onSortChange?.(column.sortKey as string)
                      : undefined
                  }
                >
                  {column.header}
                  {isActive ? (sort?.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

'use client';

export interface ListToolbarOption {
  value: string;
  label: string;
}

export interface ListToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  statusValue?: string;
  onStatusChange?: (value: string) => void;
  statusOptions?: ListToolbarOption[];
  statusLabel?: string;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOptions?: ListToolbarOption[];
  sortLabel?: string;
  onApply: () => void;
  onReset: () => void;
  extra?: React.ReactNode;
}

export function ListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm…',
  searchLabel = 'Tìm kiếm',
  statusValue,
  onStatusChange,
  statusOptions,
  statusLabel = 'Trạng thái',
  sortValue,
  onSortChange,
  sortOptions,
  sortLabel = 'Sắp xếp',
  onApply,
  onReset,
  extra,
}: ListToolbarProps) {
  return (
    <form
      className="nx-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="nx-field" style={{ margin: 0, minWidth: 200, flex: 1 }}>
        <label className="nx-label" htmlFor="list-search">
          {searchLabel}
        </label>
        <input
          id="list-search"
          className="nx-input"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      {statusOptions && onStatusChange ? (
        <div className="nx-field" style={{ margin: 0, minWidth: 160 }}>
          <label className="nx-label" htmlFor="list-status">
            {statusLabel}
          </label>
          <select
            id="list-status"
            className="nx-select"
            value={statusValue ?? ''}
            onChange={(e) => onStatusChange(e.target.value)}
          >
            <option value="">Tất cả</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {sortOptions && onSortChange ? (
        <div className="nx-field" style={{ margin: 0, minWidth: 180 }}>
          <label className="nx-label" htmlFor="list-sort">
            {sortLabel}
          </label>
          <select
            id="list-sort"
            className="nx-select"
            value={sortValue ?? ''}
            onChange={(e) => onSortChange(e.target.value)}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {extra}
      <div className="nx-toolbar-spacer" />
      <button type="submit" className="nx-btn nx-btn-primary">
        Áp dụng
      </button>
      <button type="button" className="nx-btn nx-btn-ghost" onClick={onReset}>
        Xóa lọc
      </button>
    </form>
  );
}

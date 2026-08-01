'use client';

import { useMemo, useState } from 'react';
import { useArrayQuery } from '../../../lib/use-array-query';
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/ui/DataTable';
import { ListToolbar } from '../../../components/ui/ListToolbar';

export default function Page() {
  const [entityType, setEntityType] = useState('product');
  const [entityIdInput, setEntityIdInput] = useState('');
  const [entityId, setEntityId] = useState('');
  const [sort, setSort] = useState('id_asc');
  const enabled = entityId.length > 0;
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'media',
    path: `media/by-entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId || '_')}`,
    enabled,
  });
  const sortedItems = useMemo(() => {
    const rows = [...items];
    rows.sort((a, b) => {
      const idA = String(a['id'] ?? '');
      const idB = String(b['id'] ?? '');
      const kindA = String(a['kind'] ?? a['mimeType'] ?? '');
      const kindB = String(b['kind'] ?? b['mimeType'] ?? '');
      if (sort === 'id_desc') return idB.localeCompare(idA);
      if (sort === 'kind_asc') return kindA.localeCompare(kindB);
      if (sort === 'kind_desc') return kindB.localeCompare(kindA);
      return idA.localeCompare(idB);
    });
    return rows;
  }, [items, sort]);
  const columns = useMemo<DataTableColumn<Record<string, unknown>>[]>(
    () => [
      {
        key: 'id',
        header: 'Media ID',
        render: (r) => String(r['id'] ?? '—'),
      },
      {
        key: 'kind',
        header: 'Loại',
        render: (r) => String(r['kind'] ?? r['mimeType'] ?? '—'),
      },
      {
        key: 'url',
        header: 'URL',
        render: (r) => String(r['url'] ?? r['objectKey'] ?? '—').slice(0, 60),
      },
      {
        key: 'status',
        header: 'Trạng thái',
        render: (r) => String(r['status'] ?? '—'),
      },
    ],
    [],
  );

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Media</div>
          <div className="nx-page-subtitle">
            Tra cứu media theo entity (product / review / …)
          </div>
        </div>
      </div>
      <ListToolbar
        searchValue={entityIdInput}
        onSearchChange={setEntityIdInput}
        searchPlaceholder="Entity ID…"
        searchLabel="Entity ID"
        statusValue={entityType}
        onStatusChange={setEntityType}
        statusLabel="Entity type"
        statusOptions={[
          { value: 'product', label: 'product' },
          { value: 'review', label: 'review' },
          { value: 'user', label: 'user' },
        ]}
        sortValue={sort}
        onSortChange={setSort}
        sortOptions={[
          { value: 'id_asc', label: 'ID A→Z' },
          { value: 'id_desc', label: 'ID Z→A' },
          { value: 'kind_asc', label: 'Loại A→Z' },
          { value: 'kind_desc', label: 'Loại Z→A' },
        ]}
        onApply={() => setEntityId(entityIdInput.trim())}
        onReset={() => {
          setEntityIdInput('');
          setEntityId('');
          setEntityType('product');
          setSort('id_asc');
        }}
      />
      <DataTable
        columns={columns}
        rows={enabled ? sortedItems : []}
        getRowKey={(r) => String(r.id ?? Math.random())}
        loading={enabled && loading}
        error={enabled ? error : null}
        onRetry={refetch}
        emptyTitle={enabled ? 'Không có media' : 'Nhập Entity ID'}
        emptyDescription={
          enabled
            ? 'Entity chưa có media gắn kèm.'
            : 'Nhập ID sản phẩm/đánh giá rồi bấm Áp dụng.'
        }
      />
    </div>
  );
}

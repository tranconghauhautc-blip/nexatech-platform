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
  const enabled = entityId.length > 0;
  const { items, loading, error, refetch } = useArrayQuery<
    Record<string, unknown>
  >({
    service: 'media',
    path: `media/by-entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId || '_')}`,
    enabled,
  });
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
        onApply={() => setEntityId(entityIdInput.trim())}
        onReset={() => {
          setEntityIdInput('');
          setEntityId('');
          setEntityType('product');
        }}
      />
      <DataTable
        columns={columns}
        rows={enabled ? items : []}
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

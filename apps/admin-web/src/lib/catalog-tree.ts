import type { CategoryTreeNode } from './types';

export interface FlatCategory {
  node: CategoryTreeNode;
  depth: number;
}

/** Duyệt cây danh mục thành danh sách phẳng có `depth` để hiển thị thụt lề trong bảng. */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
): FlatCategory[] {
  const result: FlatCategory[] = [];
  const sorted = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const node of sorted) {
    result.push({ node, depth });
    if (node.children.length > 0) {
      result.push(...flattenCategoryTree(node.children, depth + 1));
    }
  }
  return result;
}

/** Loại bỏ chính node và toàn bộ hậu duệ khỏi danh sách lựa chọn danh mục cha (tránh vòng lặp). */
export function excludeSubtree(
  flat: FlatCategory[],
  excludeId: string | null,
): FlatCategory[] {
  if (!excludeId) {
    return flat;
  }
  const excludedIds = new Set<string>([excludeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const { node } of flat) {
      if (
        node.parentId &&
        excludedIds.has(node.parentId) &&
        !excludedIds.has(node.id)
      ) {
        excludedIds.add(node.id);
        changed = true;
      }
    }
  }
  return flat.filter(({ node }) => !excludedIds.has(node.id));
}

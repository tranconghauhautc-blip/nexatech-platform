import type { CategoryTreeNode } from './types';
import { getCategoryTreeResult } from './catalog-server';

export interface NavCategory {
  slug: string;
  label: string;
  sortOrder?: number;
}

/** Active categories only — depth-first, children after parent, sorted by sortOrder. */
export function flattenActiveCategories(
  tree: CategoryTreeNode[],
): NavCategory[] {
  const result: NavCategory[] = [];

  function walk(nodes: CategoryTreeNode[]) {
    const active = nodes
      .filter((node) => node.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of active) {
      result.push({
        slug: node.slug,
        label: node.name,
        sortOrder: node.sortOrder,
      });
      if (node.children.length > 0) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return result;
}

export async function loadNavCategories(): Promise<{
  categories: NavCategory[];
  error: boolean;
}> {
  const result = await getCategoryTreeResult();
  if (!result.ok) {
    return { categories: [], error: true };
  }
  return {
    categories: flattenActiveCategories(result.data),
    error: false,
  };
}

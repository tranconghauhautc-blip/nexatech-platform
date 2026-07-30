import { render, screen } from '@testing-library/react';
import Page from '../src/app/page';

jest.mock('../src/lib/catalog-server', () => ({
  searchProducts: jest.fn().mockResolvedValue({
    items: [],
    meta: { page: 1, pageSize: 8, totalItems: 0, totalPages: 1 },
  }),
  getBrands: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/components/product/recently-viewed-section', () => ({
  RecentlyViewedSection: () => <div>Recently viewed</div>,
}));

describe('Storefront home', () => {
  it('renders NexaTech hero', async () => {
    const ui = await Page();
    render(ui);
    expect(
      screen.getByRole('heading', { name: /Công nghệ chính hãng/i }),
    ).toBeTruthy();
  });
});

/**
 * @jest-environment node
 */
import Page from '../src/app/page';

describe('Admin root page', () => {
  it('exports a page component', () => {
    expect(typeof Page).toBe('function');
  });
});

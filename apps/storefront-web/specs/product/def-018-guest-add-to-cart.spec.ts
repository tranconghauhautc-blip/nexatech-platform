import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * DEF-018 source regression: guest add-to-cart must not call requireLoginOrContinue.
 */
describe('DEF-018 product-purchase-panel source', () => {
  const source = readFileSync(
    join(__dirname, '../../src/components/product/product-purchase-panel.tsx'),
    'utf8',
  );

  it('does not define requireLoginOrContinue gate', () => {
    expect(source).not.toMatch(/function requireLoginOrContinue/);
  });

  it('handleAddToCart calls addItem without login redirect first', () => {
    expect(source).toMatch(/async function handleAddToCart/);
    const addFn = source.slice(
      source.indexOf('async function handleAddToCart'),
    );
    const body = addFn.slice(0, addFn.indexOf('async function handleBuyNow'));
    expect(body).toMatch(/await addItem\(/);
    expect(body).not.toMatch(/requireLoginOrContinue/);
    expect(body).not.toMatch(/router\.push\(\s*`\/dang-nhap/);
  });
});

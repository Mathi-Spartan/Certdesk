import { q } from './db';

/**
 * What a customer may order. The master account picks products per workspace
 * (console.workspace_products); only those can be ordered there. Everything else
 * shows as "Coming soon". The master (admin) account itself is not limited.
 * ORDERING_OPEN=true opens every enabled product to every customer.
 */
export const customerOrderingOpen = () => process.env.ORDERING_OPEN === 'true';
export const CLOSED_MSG = 'This certificate is not available to order on your account yet. Ask your provider.';

export async function allowedProductIds(workspaceId) {
  if (!workspaceId) return new Set();
  const rows = await q('select product_id from console.workspace_products where workspace_id = $1', [workspaceId]);
  return new Set(rows.map((r) => Number(r.product_id)));
}

/** True when this context may order the given product (or, with no product, anything at all). */
export async function canOrderProduct(ctx, productId) {
  if (ctx?.isAdmin || customerOrderingOpen()) return true;
  const ids = await allowedProductIds(ctx?.workspaceId);
  return productId === undefined ? ids.size > 0 : ids.has(Number(productId));
}

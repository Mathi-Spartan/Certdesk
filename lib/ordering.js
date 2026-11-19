/**
 * Customer ordering switch. While closed, customer accounts see the catalogue with
 * "Coming soon" and no prices, and every order action refuses them on the server.
 * The master (admin) account is not affected. Set ORDERING_OPEN=true to open it.
 */
export const customerOrderingOpen = () => process.env.ORDERING_OPEN === 'true';
export const canOrder = (ctx) => !!ctx?.isAdmin || customerOrderingOpen();
export const CLOSED_MSG = 'Ordering opens soon. Your provider will let you know when it is available.';

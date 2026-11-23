/** Orders and subscriptions can be cancelled only within this many days of purchase. */
export const CANCEL_DAYS = 30;
const DAY = 86400000;

const t = (d) => {
  const v = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(v) ? v : null;
};

/**
 * Cancellation window for an order or a subscription.
 * Purchase date = the earliest of when the order was placed and when its subscription began
 * (imported orders carry GoGetSSL's begin date in both).
 */
export function cancelWindow(rec, now = Date.now()) {
  const status = String(rec?.status || '');
  if (status === 'cancelled' || rec?.cancel_requested_at || status === 'cancel_requested') return { allowed: false, reason: 'already' };
  const dates = [rec?.created_at, rec?.order_starts_at, rec?.begin_at].map(t).filter((v) => v !== null);
  if (!dates.length) return { allowed: false, reason: 'unknown' };
  const purchased = Math.min(...dates);
  const deadline = purchased + CANCEL_DAYS * DAY;
  return {
    allowed: now <= deadline,
    reason: now <= deadline ? null : 'expired',
    purchased: new Date(purchased),
    deadline: new Date(deadline),
    daysLeft: Math.max(0, Math.ceil((deadline - now) / DAY))
  };
}

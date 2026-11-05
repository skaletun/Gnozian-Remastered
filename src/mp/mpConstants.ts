/** Polling `GET /matches/:id` when it is not this client's sub-turn. */
export const MP_POLL_INTERVAL_MS = 2500;
/** Slow heartbeat while it *is* our turn — only checks reconnect/disconnect flags without overwriting local moves. */
export const MP_MY_TURN_HEARTBEAT_MS = 8500;
/** Polling back-off when `mpGetMatch` fails (network); capped exponential. */
export const MP_POLL_BACKOFF_MAX_MS = 20_000;

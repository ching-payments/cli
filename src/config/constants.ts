// Production CHING endpoints. Internal devs that want to point at a
// local glance-api-v2 / ching-front edit these constants in their
// checkout - we deliberately do not expose an env-var override on the
// public CLI surface.
export const API_BASE = "https://api.ching.co.il/ching/v1"
export const DASHBOARD_BASE = "https://app.ching.co.il"

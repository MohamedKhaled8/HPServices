/**
 * Security utilities to manage rate limiting and data validation.
 */

const rateLimits: Record<string, number[]> = {};

/**
 * Basic client-side rate limiter.
 * @param actionName Name of the action (e.g., 'login', 'register')
 * @param limit Number of allowed attempts
 * @param interval Time window in milliseconds (e.g., 1 minute)
 * @returns boolean True if action is allowed, false if blocked
 */
export const checkRateLimit = (actionName: string, limit: number = 5, interval: number = 60000): boolean => {
    const now = Date.now();

    if (!rateLimits[actionName]) {
        rateLimits[actionName] = [];
    }

    // Remove attempts outside the interval
    rateLimits[actionName] = rateLimits[actionName].filter(timestamp => now - timestamp < interval);

    if (rateLimits[actionName].length >= limit) {
        return false;
    }

    rateLimits[actionName].push(now);
    return true;
};

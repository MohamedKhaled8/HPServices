/**
 * Security utilities to manage rate limiting, brute-force defense, and data protection.
 */

const STORAGE_KEY = 'hp_sec_auth_throttle_v1';

interface ThrottleRecord {
    attempts: number;
    lockedUntil: number;
    lastAttempt: number;
}

type ThrottleStore = Record<string, ThrottleRecord>;

const getStore = (): ThrottleStore => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as ThrottleStore;
    } catch {
        return {};
    }
};

const saveStore = (store: ThrottleStore) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Storage might be restricted or full
    }
};

const normalizeKey = (action: string, identifier: string = 'global'): string => {
    return `${action}:${identifier.trim().toLowerCase().replace(/\s+/g, '')}`;
};

/**
 * Basic in-memory rate limiter for backwards compatibility
 */
const inMemoryLimits: Record<string, number[]> = {};

export const checkRateLimit = (actionName: string, limit: number = 5, interval: number = 60000): boolean => {
    const now = Date.now();
    if (!inMemoryLimits[actionName]) {
        inMemoryLimits[actionName] = [];
    }
    inMemoryLimits[actionName] = inMemoryLimits[actionName].filter(timestamp => now - timestamp < interval);
    if (inMemoryLimits[actionName].length >= limit) {
        return false;
    }
    inMemoryLimits[actionName].push(now);
    return true;
};

export interface LockoutStatus {
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
    message?: string;
}

const MAX_LOGIN_ATTEMPTS = 5;
const INITIAL_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const EXTENDED_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes reset if inactive

/**
 * Checks if a login attempt is currently locked out due to multiple failed attempts.
 */
export const checkLoginLockout = (identifier: string): LockoutStatus => {
    if (!identifier) return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };

    const store = getStore();
    const key = normalizeKey('login', identifier);
    const record = store[key];

    if (!record) {
        return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
    }

    const now = Date.now();

    // Check if lockout is active
    if (record.lockedUntil > now) {
        const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return {
            isLocked: true,
            remainingSeconds,
            attemptsLeft: 0,
            message: `تم حظر محاولات الدخول مؤقتاً لحماية الحساب لكثرة المحاولات الخاطئة. يرجى المحاولة بعد ${remainingSeconds} ثانية.`
        };
    }

    // Reset if window expired without lockout
    if (now - record.lastAttempt > WINDOW_EXPIRY_MS && record.lockedUntil <= now) {
        delete store[key];
        saveStore(store);
        return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };
    }

    const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - record.attempts);
    return {
        isLocked: false,
        remainingSeconds: 0,
        attemptsLeft
    };
};

/**
 * Records a failed login attempt and enforces progressive lockouts.
 */
export const recordLoginFailure = (identifier: string): LockoutStatus => {
    if (!identifier) return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_LOGIN_ATTEMPTS };

    const store = getStore();
    const key = normalizeKey('login', identifier);
    const now = Date.now();
    const record: ThrottleRecord = store[key] || { attempts: 0, lockedUntil: 0, lastAttempt: now };

    record.attempts += 1;
    record.lastAttempt = now;

    if (record.attempts >= 8) {
        record.lockedUntil = now + EXTENDED_LOCKOUT_MS;
    } else if (record.attempts >= MAX_LOGIN_ATTEMPTS) {
        record.lockedUntil = now + INITIAL_LOCKOUT_MS;
    }

    store[key] = record;
    saveStore(store);

    if (record.lockedUntil > now) {
        const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return {
            isLocked: true,
            remainingSeconds,
            attemptsLeft: 0,
            message: `تم حظر محاولات الدخول مؤقتاً لحماية الحساب لكثرة المحاولات الخاطئة. يرجى المحاولة بعد ${remainingSeconds} ثانية.`
        };
    }

    const attemptsLeft = Math.max(0, MAX_LOGIN_ATTEMPTS - record.attempts);
    return {
        isLocked: false,
        remainingSeconds: 0,
        attemptsLeft,
        message: attemptsLeft > 0
            ? `بيانات الدخول غير صحيحة. متبقي لديك ${attemptsLeft} محاولات قبل حظر الحساب مؤقتاً.`
            : undefined
    };
};

/**
 * Resets the failed attempts on successful login.
 */
export const recordLoginSuccess = (identifier: string) => {
    if (!identifier) return;
    const store = getStore();
    const key = normalizeKey('login', identifier);
    if (store[key]) {
        delete store[key];
        saveStore(store);
    }
};

/**
 * Limits forgot password requests to prevent mass scraping of student info (Max 3 attempts per 2 mins).
 */
export const checkForgotPasswordLimit = (identifier: string): { allowed: boolean; message?: string } => {
    const store = getStore();
    const key = normalizeKey('forgot_pw', identifier);
    const now = Date.now();
    const record = store[key] || { attempts: 0, lockedUntil: 0, lastAttempt: now };

    if (now - record.lastAttempt > 2 * 60 * 1000) {
        record.attempts = 0;
    }

    record.attempts += 1;
    record.lastAttempt = now;

    if (record.attempts > 3) {
        store[key] = record;
        saveStore(store);
        return {
            allowed: false,
            message: 'تجاوزت الحد المسموح به لمحاولات استعادة كلمة المرور. يرجى الانتظار لدقيقتين قبل المحاولة مجدداً.'
        };
    }

    store[key] = record;
    saveStore(store);
    return { allowed: true };
};

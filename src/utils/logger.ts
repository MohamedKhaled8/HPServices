/**
 * Logger utility to manage logs across the application.
 * In production mode, all logs are suppressed except for errors.
 */

const isDev = import.meta.env.DEV;

export const logger = {
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },
    error: (...args: any[]) => {
        // We always keep errors for troubleshooting, even in production
        console.error(...args);
    },
    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    }
};

export default logger;

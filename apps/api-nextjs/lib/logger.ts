/**
 * Utility for formatted logging with context.
 */
export const logger = {
    info: (context: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
        console.log(`[${timestamp}] [INFO] [${context}] ${message}${dataStr}`);
    },
    warn: (context: string, message: string, data?: any) => {
        const timestamp = new Date().toISOString();
        const dataStr = data ? ` | Data: ${JSON.stringify(data)}` : '';
        console.warn(`[${timestamp}] [WARN] [${context}] ${message}${dataStr}`);
    },
    error: (context: string, message: string, error?: any) => {
        const timestamp = new Date().toISOString();
        const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
        console.error(`[${timestamp}] [ERROR] [${context}] ${message} | Error: ${errorMsg}`);
    }
};

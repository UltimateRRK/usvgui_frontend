/**
 * console.ts — shared types and helpers for the System Console log.
 * Lives in types/ so both hooks and components can import it without
 * creating a circular dependency.
 */

export type ConsoleLevel = "info" | "success" | "warn" | "error" | "nav" | "system";

export interface ConsoleEntry {
    id: string;
    timestamp: string;
    level: ConsoleLevel;
    message: string;
}

export function makeLog(level: ConsoleLevel, message: string): ConsoleEntry {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
        }),
        level,
        message,
    };
}

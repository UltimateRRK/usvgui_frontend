/**
 * SystemConsole.tsx
 *
 * Dark terminal-style scrollable log window.
 * Displays system events: mission status, errors, navigation events, etc.
 * Auto-scrolls to the latest entry.
 */

import { useEffect, useRef } from "react";
import { Terminal, AlertTriangle, CheckCircle, Info, Zap, Radio } from "lucide-react";
import { ConsoleEntry, ConsoleLevel } from "../../types/console";

// Re-export so existing imports from this file still work
export type { ConsoleEntry, ConsoleLevel };
export { makeLog } from "../../types/console";

interface SystemConsoleProps {
    entries: ConsoleEntry[];
}

const LEVEL_CONFIG: Record<ConsoleLevel, { icon: React.ReactNode; color: string; prefix: string }> = {
    info:    { icon: <Info     size={11} />, color: "text-sky-400",    prefix: "INFO   " },
    success: { icon: <CheckCircle size={11} />, color: "text-emerald-400", prefix: "OK     " },
    warn:    { icon: <AlertTriangle size={11} />, color: "text-amber-400",  prefix: "WARN   " },
    error:   { icon: <AlertTriangle size={11} />, color: "text-red-400",    prefix: "ERROR  " },
    nav:     { icon: <Zap      size={11} />, color: "text-violet-400",  prefix: "NAV    " },
    system:  { icon: <Radio    size={11} />, color: "text-slate-400",   prefix: "SYSTEM " },
};




export function SystemConsole({ entries }: SystemConsoleProps) {
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new entries arrive
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [entries]);

    return (
        <div className="bg-slate-950 border border-slate-700 rounded-xl flex flex-col" style={{ height: "100%" }}>
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 shrink-0">
                <Terminal size={14} className="text-emerald-400" />
                <span className="text-xs font-semibold text-slate-300 tracking-widest uppercase">
                    System Console
                </span>
                <span className="ml-auto text-xs text-slate-600 font-mono">
                    {entries.length} entries
                </span>
                {/* Traffic light dots */}
                <div className="flex gap-1.5 ml-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                </div>
            </div>

            {/* Log body */}
            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs space-y-0.5 min-h-0">
                {entries.length === 0 && (
                    <div className="text-slate-700 italic mt-4 text-center">
                        System ready. Waiting for events...
                    </div>
                )}
                {entries.map((entry) => {
                    const cfg = LEVEL_CONFIG[entry.level];
                    return (
                        <div key={entry.id} className="flex items-start gap-2 py-0.5 leading-relaxed">
                            {/* Timestamp */}
                            <span className="text-slate-700 shrink-0 select-none">
                                {entry.timestamp}
                            </span>
                            {/* Level badge */}
                            <span className={`flex items-center gap-0.5 shrink-0 ${cfg.color}`}>
                                {cfg.icon}
                                <span className="hidden sm:inline">{cfg.prefix}</span>
                            </span>
                            {/* Message */}
                            <span className="text-slate-300 break-words">{entry.message}</span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

import { EventEmitter } from 'events';

class LogBroadcaster extends EventEmitter {
    private history: string[] = [];
    private readonly MAX_HISTORY = 500;

    constructor() {
        super();
        this.hookConsole();
    }

    private hookConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args: any[]) => {
            this.broadcast('log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args: any[]) => {
            this.broadcast('error', args);
            originalError.apply(console, args);
        };

        console.warn = (...args: any[]) => {
            this.broadcast('warn', args);
            originalWarn.apply(console, args);
        };
    }

    public broadcastProgress(data: { stage: string; progress: number; message: string }) {
        // Emit as a specialized event, not purely a text log
        this.emit('progress', data);

        // Also log to history for debugging (optional)
        // this.broadcast('info', [`[PROGRESS-${data.stage}] ${data.progress}% - ${data.message}`]);
    }

    private broadcast(level: string, args: any[]) {
        try {
            // Convert args to string safely
            const message = args.map(arg => {
                if (typeof arg === 'string') return arg;
                try {
                    return JSON.stringify(arg);
                } catch (e) {
                    return '[Circular/Unserializable]';
                }
            }).join(' ');

            const logEntry = JSON.stringify({
                timestamp: new Date().toISOString(),
                level,
                message
            });

            this.history.push(logEntry);
            if (this.history.length > this.MAX_HISTORY) {
                this.history.shift();
            }

            this.emit('log', logEntry);
        } catch (e) {
            // Failsafe to prevent loop
        }
    }

    public getHistory() {
        return this.history;
    }
}

export const logBroadcaster = new LogBroadcaster();

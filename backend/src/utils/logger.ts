import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Lazy initialization to ensure environment variables are loaded
let loggerInstance: winston.Logger | null = null;

function createLogger(): winston.Logger {
  // Ensure logs directory exists
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Define log format
  const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  );

  // Create logger instance with environment-based configuration
  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
      // Write logs to console
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          logFormat
        )
      }),
      // Write logs to file in both production and development
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ],
  });
}

// Export a proxy object that lazily initializes the logger
const logger = new Proxy({} as winston.Logger, {
  get(target, prop) {
    if (!loggerInstance) {
      loggerInstance = createLogger();
    }
    const value = (loggerInstance as any)[prop];
    return typeof value === 'function' ? value.bind(loggerInstance) : value;
  }
});

export default logger;

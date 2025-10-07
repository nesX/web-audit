import winston from 'winston';
import 'winston/lib/winston/transports/index.js';

const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

// Logger for general application status and errors
const appLogger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize(),
        logFormat
      ),
    }),
    new transports.File({ filename: 'logs/app.log' }),
  ],
});

// Logger for SEO observations
const observationLogger = createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new transports.File({ filename: 'logs/observations.log' }),
  ],
});

export const logger = appLogger;
export const auditLogger = observationLogger;
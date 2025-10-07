const winston = require('winston');
const path = require('path');

const createLogger = (filename) => {
    return winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss'
            }),
            winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
        transports: [
            new winston.transports.File({ filename: path.join('logs', filename) })
        ]
    });
};

const observationsLogger = createLogger('observations.log');
const processLogger = createLogger('process.log');

module.exports = {
    observationsLogger,
    processLogger
};
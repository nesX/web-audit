const Queue = require('bull');
const config = require('./config');

const scanQueue = new Queue('scan-queue', {
  redis: config.redis,
});

module.exports = {
    scanQueue
};
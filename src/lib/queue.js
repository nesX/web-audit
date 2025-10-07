import Bull from 'bull';
import dotenv from 'dotenv';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
};

// Create a new Bull queue named 'scan'
const scanQueue = new Bull('scan', {
  redis: redisConfig,
  limiter: {
    max: 1000, // Max 1000 jobs
    duration: 5000, // per 5 seconds
  },
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  },
});

export default scanQueue;
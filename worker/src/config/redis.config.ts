import { Redis, RedisOptions } from 'ioredis';

const redisConfig: RedisOptions = {
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST || 'localhost',
    maxRetriesPerRequest: null
}

export const redisConnection = new Redis(redisConfig)


redisConnection.on('error', (err) => {
    console.error('Worker[Redis Connection Error]', err);
});

redisConnection.on('connect', () => {
    console.log('[Worker] Redis connected successfully.');
});
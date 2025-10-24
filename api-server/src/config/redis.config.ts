import { Redis, RedisOptions } from 'ioredis';


const redisConfig:RedisOptions = {
    port: parseInt(process.env.REDIS_PORT || '6379'),
    host: process.env.REDIS_HOST || 'localhost',
    // password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null
}

export const redisConnection = new Redis(redisConfig)


redisConnection.on('error', (err) => {
    console.error('[Redis Connection Error]', err);
});

redisConnection.on('connect', () => {
    console.log('[Redis Connection] Connected successfully.');
});
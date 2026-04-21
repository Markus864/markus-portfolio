/**
 * Iron Strike Worker Entry Point
 * 
 * Standalone process for running bots and background workers
 * separately from the main web server. Used in AWS ECS worker tasks.
 * 
 * Usage: npm run start:worker (production)
 * Or: npx tsx server/worker.ts (development)
 */

import { startDiscordBot } from './bot';
import { startTelegramBot } from './telegram-bot';
import { startPriceAlertWorker } from './price-alert-worker';

async function startAllWorkers() {
  console.log('👷 Starting Iron Strike Workers...');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // 1. Start Discord Bot
  try {
    await startDiscordBot();
    console.log('✅ Discord Bot started');
  } catch (err) {
    console.error('❌ Failed to start Discord Bot:', err);
  }

  // 2. Start Telegram Bot
  try {
    await startTelegramBot();
    console.log('✅ Telegram Bot started');
  } catch (err) {
    console.error('❌ Failed to start Telegram Bot:', err);
  }

  // 3. Start Price Alert Worker
  try {
    await startPriceAlertWorker();
    console.log('✅ Price Alert Worker started');
  } catch (err) {
    console.error('❌ Failed to start Price Alert Worker:', err);
  }

  console.log('👷 All workers initialized');
  
  // Keep process alive
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down workers...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down workers...');
    process.exit(0);
  });
}

startAllWorkers();

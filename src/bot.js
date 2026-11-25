
import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';

import {
  getState,
  addCreator,
  removeCreator
} from './state.js';

import {
  activeRecordings,
  stopCreator
} from './monitor.js';

const HELP = `
🎥 TikTok LIVE Auto Recorder

/add username
Remove monitoring:
 /remove username

/list
/status
/recordings

⏹ Stop recording and upload:
 /stop username

/help
`;

export function createBot() {
  const bot = new TelegramBot(
    config.telegramToken,
    { polling: true }
  );

  bot.on('polling_error', error => {
    console.error('Telegram polling error:', error.message);
  });

  bot.on('message', async msg => {
    const chatId = String(msg.chat.id);
    const userId = String(msg.from?.id ?? '');

    if (
      userId !== config.allowedUserId ||
      chatId !== config.allowedUserId
    ) {
      return bot.sendMessage(chatId, '⛔ Not authorized.');
    }

    const text = (msg.text || '').trim();
    const [rawCommand, ...args] = text.split(/\s+/);

    const command = (rawCommand || '')
      .split('@')[0]
      .toLowerCase();

    const username = (args[0] || '')
      .replace(/^@/, '')
      .toLowerCase();

    try {
      switch (command) {

        case '/start':
        case '/help':
          return bot.sendMessage(chatId, HELP);

        case '/add': {
          if (!username) {
            return bot.sendMessage(chatId, 'Usage: /add username');
          }

          const added = await addCreator(username);

          return bot.sendMessage(
            chatId,
            added
              ? `✅ Monitoring @${username}`
              : `ℹ️ @${username} is already monitored.`
          );
        }

        case '/remove': {
          if (!username) {
            return bot.sendMessage(chatId, 'Usage: /remove username');
          }

          const removed = await removeCreator(username);

          return bot.sendMessage(
            chatId,
            removed
              ? `🗑 Removed @${username}. Active recording will be finalized.`
              : `@${username} was not found.`
          );
        }

        case '/list': {
          const creators = getState().creators;

          return bot.sendMessage(
            chatId,
            creators.length
              ? '👥 Monitored creators:\n' +
                creators.map(x => `• @${x.username}`).join('\n')
              : 'No creators monitored.'
          );
        }

        case '/status': {
          const active = activeRecordings();

          return bot.sendMessage(
            chatId,
            `📡 TikTok Recorder Status\n\n` +
            `Monitored: ${getState().creators.length}\n` +
            `Active recordings: ${active.length}\n` +
            `Polling: ${config.pollSeconds}s\n\n` +
            (active.length
              ? active.map(x => `🔴 @${x}`).join('\n')
              : 'No active recordings.')
          );
        }

        case '/stop': {
          if (!username) {
            return bot.sendMessage(
              chatId,
              'Usage: /stop username\n\nExample: /stop ns.raven_15'
            );
          }

          if (!activeRecordings().includes(username)) {
            return bot.sendMessage(
              chatId,
              `ℹ️ No active recording found for @${username}.`
            );
          }

          await bot.sendMessage(
            chatId,
            `⏹ Stopping recording for @${username}...\nPreparing upload to B2.`
          );

          // finish() stops FFmpeg and uploads the recording.
          await stopCreator(username);

          return bot.sendMessage(
            chatId,
            `✅ Stop and finalization process completed for @${username}.\n\n` +
            `Check the upload notification for your B2 download link.`
          );
        }

        case '/recordings': {
          const recordings = getState().recordings.slice(0, 10);

          if (!recordings.length) {
            return bot.sendMessage(
              chatId,
              '🎞 No completed recordings yet.'
            );
          }

          return bot.sendMessage(
            chatId,
            '🎞 Recent recordings:\n\n' +
            recordings.map(record =>
              `👤 @${record.username}\n` +
              `📦 ${(record.bytes / 1048576).toFixed(2)} MB\n` +
              `${record.url}`
            ).join('\n\n'),
            { disable_web_page_preview: true }
          );
        }

        default:
          return bot.sendMessage(chatId, 'Unknown command. Use /help');
      }

    } catch (error) {
      console.error('Telegram command error:', error);

      return bot.sendMessage(
        chatId,
        `❌ Command failed:\n${error.message}`
      );
    }
  });

  return bot;
}


import { TikTokLiveConnection } from 'tiktok-live-connector';
import fs from 'node:fs/promises';

import { config } from './config.js';
import { getState, addRecording } from './state.js';
import { startRecording } from './recorder.js';
import { uploadRecording } from './storage.js';

const active = new Map();

let bot = null;
let busy = false;

export function setBot(instance) {
  bot = instance;
}

async function notify(message) {
  if (!bot) return;

  try {
    await bot.sendMessage(
      config.allowedUserId,
      message,
      { disable_web_page_preview: true }
    );
  } catch (error) {
    console.error('Telegram notification failed:', error.message);
  }
}

function connectionFor(username) {
  return new TikTokLiveConnection(username, {
    fetchRoomInfoOnConnect: false
  });
}

// Extract available HTTPS HLS or FLV stream URL.
function extractStreamUrl(roomInfo) {
  if (!roomInfo) return null;

  const stream = roomInfo.stream_url ||
                 roomInfo.data?.stream_url ||
                 {};

  const directCandidates = [
    stream.hls_pull_url,
    stream.flv_pull_url,
    roomInfo.hls_pull_url,
    roomInfo.flv_pull_url
  ];

  for (const url of directCandidates) {
    if (
      typeof url === 'string' &&
      url.startsWith('https://')
    ) {
      return url;
    }
  }

  const maps = [
    stream.hls_pull_url_map,
    stream.flv_pull_url_map
  ];

  for (const map of maps) {
    if (!map || typeof map !== 'object') continue;

    const url = Object.values(map).find(value =>
      typeof value === 'string' &&
      value.startsWith('https://')
    );

    if (url) return url;
  }

  return null;
}

// Start recording when a creator is LIVE.
async function begin(username) {
  if (active.has(username)) return;

  if (active.size >= config.maxRecordings) {
    console.warn(`Recording limit reached: @${username}`);
    return;
  }

  const connection = connectionFor(username);

  try {
    console.log(`Resolving LIVE room for @${username}...`);

    const roomId = await connection.fetchRoomId();

    if (!roomId) {
      throw new Error('Could not resolve TikTok LIVE room ID.');
    }

    console.log(`Room ID for @${username}: ${roomId}`);

    const roomInfo = await connection.fetchRoomInfo(roomId);

    console.log(
      `Room information keys for @${username}:`,
      Object.keys(roomInfo || {})
    );

    console.log(
      `Stream information keys:`,
      Object.keys(
        roomInfo?.stream_url ||
        roomInfo?.data?.stream_url ||
        {}
      )
    );

    const streamUrl = extractStreamUrl(roomInfo);

    if (!streamUrl) {
      console.error(
        'Stream response structure:',
        JSON.stringify({
          roomId,
          roomInfoKeys: Object.keys(roomInfo || {}),
          streamKeys: Object.keys(
            roomInfo?.stream_url ||
            roomInfo?.data?.stream_url ||
            {}
          )
        }, null, 2)
      );

      throw new Error(
        'TikTok LIVE detected, but no accessible HLS or FLV URL was returned.'
      );
    }

    console.log(`Starting FFmpeg for @${username}...`);

    const recorder = await startRecording(
      username,
      streamUrl
    );

    const session = {
      recorder,
      offlineCount: 0,
      startedAt: recorder.startedAt
    };

    active.set(username, session);

    console.log(`Recording started: @${username}`);

    await notify(
      `🔴 TikTok LIVE detected!\n\n` +
      `Creator: @${username}\n` +
      `Room ID: ${roomId}\n` +
      `Status: Recording started`
    );

    recorder.child.once('close', (code, signal) => {
      console.log(
        `FFmpeg exited for @${username}: code=${code}, signal=${signal}`
      );
    });

  } catch (error) {
    console.error(
      `Could not start recording @${username}:`,
      error.message
    );

    await notify(
      `⚠️ Recording could not start\n\n` +
      `Creator: @${username}\n` +
      `Error: ${error.message}`
    );

  } finally {
    try {
      await connection.disconnect();
    } catch {}
  }
}

// Stop recording and upload the completed file.
async function finish(username, reason = 'LIVE ended') {
  const session = active.get(username);

  if (!session) return;

  // Prevent duplicate finalization.
  active.delete(username);

  const recorder = session.recorder;

  try {
    console.log(`Stopping recording: @${username}`);

    await recorder.stop();

    const stat = await fs.stat(recorder.output);

    if (stat.size < 1024) {
      throw new Error('Recording is empty or too small.');
    }

    const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

    await notify(
      `⏹ Recording finished\n\n` +
      `Creator: @${username}\n` +
      `Reason: ${reason}\n` +
      `Size: ${sizeMB} MB\n\n` +
      `Uploading to Backblaze B2...`
    );

    console.log(`Uploading @${username} to B2...`);

    const uploaded = await uploadRecording(
      recorder.output,
      username,
      recorder.startedAt
    );

    const record = {
      username,
      startedAt: recorder.startedAt,
      finishedAt: new Date().toISOString(),
      bytes: stat.size,
      objectKey: uploaded.key,
      url: uploaded.url
    };

    await addRecording(record);

    console.log(`B2 upload completed: @${username}`);

    await notify(
      `☁️ Recording uploaded successfully!\n\n` +
      `Creator: @${username}\n` +
      `Size: ${sizeMB} MB\n` +
      `Storage: Backblaze B2\n\n` +
      `Download link:\n${uploaded.url}\n\n` +
      `Link expires in ${Math.round(config.b2.linkExpiry / 3600)} hours.`
    );

    await fs.unlink(recorder.output).catch(() => {});

  } catch (error) {
    console.error(
      `Recording finalization failed for @${username}:`,
      error
    );

    await notify(
      `❌ Recording upload failed\n\n` +
      `Creator: @${username}\n` +
      `Local recording retained:\n${recorder.output}\n\n` +
      `Error: ${error.message}`
    );
  }
}

// Check whether a creator is currently LIVE.
async function checkCreator(username) {
  const connection = connectionFor(username);

  try {
    const isLive = await connection.fetchIsLive();

    if (isLive) {
      if (!active.has(username)) {
        console.log(`LIVE detected: @${username}`);
        await begin(username);
      } else {
        active.get(username).offlineCount = 0;
      }

    } else if (active.has(username)) {
      const session = active.get(username);

      session.offlineCount++;

      console.log(
        `@${username} offline confirmation: ` +
        `${session.offlineCount}/${config.offlineConfirmations}`
      );

      if (
        session.offlineCount >= config.offlineConfirmations
      ) {
        await finish(username, 'TikTok LIVE ended');
      }
    }

  } catch (error) {
    // Network errors are not treated as offline.
    console.warn(
      `LIVE check failed for @${username}:`,
      error.message
    );

  } finally {
    try {
      await connection.disconnect();
    } catch {}
  }
}

// Main monitoring loop.
export async function runMonitor() {
  if (busy) return;

  busy = true;

  try {
    const creators = getState()
      .creators
      .filter(creator => creator.enabled)
      .map(creator => creator.username);

    for (const username of creators) {
      await checkCreator(username);
    }

    // Finalize recordings for creators removed from monitoring.
    for (const username of [...active.keys()]) {
      if (!creators.includes(username)) {
        await finish(username, 'Removed from monitoring');
      }
    }

  } catch (error) {
    console.error('Monitor loop error:', error);

  } finally {
    busy = false;
  }
}

// Start automatic monitoring.
export function startMonitor() {
  console.log(
    `TikTok LIVE monitor started. Interval: ${config.pollSeconds}s`
  );

  runMonitor().catch(console.error);

  const timer = setInterval(() => {
    runMonitor().catch(console.error);
  }, config.pollSeconds * 1000);

  timer.unref?.();
}

// Telegram command support.
export async function stopCreator(username) {
  await finish(username, 'Stopped manually through Telegram');
}

export function activeRecordings() {
  return [...active.keys()];
}

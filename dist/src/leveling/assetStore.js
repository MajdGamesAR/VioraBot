const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const ASSET_DIR = path.join(os.tmpdir(), 'viora-assets');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Store a local file path as a temp asset, return an attachment-like object.
 * @param {string} filePath - Absolute path to the file
 * @returns {{ name: string, path: string, size: number }}
 */
function storeAsset(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Asset not found: ${filePath}`);
  }
  ensureDir(ASSET_DIR);
  const ext = path.extname(filePath) || '.png';
  const name = `asset_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const dest = path.join(ASSET_DIR, name);
  fs.copyFileSync(filePath, dest);
  const stat = fs.statSync(dest);
  return { name, path: dest, size: stat.size };
}

/**
 * Upload an attachment buffer or file path, optionally via a message's channel.
 * Returns an attachment-like object with `url` if uploaded.
 * @param {Buffer|string} attachment - Buffer or file path
 * @param {string} name - Filename for the attachment
 * @param {{ useMessage?: object }} opts
 * @returns {Promise<{ name: string, path?: string, buffer?: Buffer, size: number, url?: string }>}
 */
async function uploadAsset(attachment, name, opts = {}) {
  const { useMessage } = opts;

  let buf;
  if (Buffer.isBuffer(attachment)) {
    buf = attachment;
  } else if (typeof attachment === 'string' && fs.existsSync(attachment)) {
    buf = fs.readFileSync(attachment);
  } else {
    throw new Error('Invalid attachment: expected Buffer or existing file path');
  }

  const result = { name, buffer: buf, size: buf.length };

  // If a message is provided and has a channel, try to send the attachment there
  if (useMessage && useMessage.channel && typeof useMessage.channel.send === 'function') {
    try {
      const Discord = require('discord.js');
      const att = new Discord.AttachmentBuilder(buf, { name });
      const sent = await useMessage.channel.send({ files: [att] });
      const sentAtt = sent.attachments.first();
      if (sentAtt) {
        result.url = sentAtt.url;
      }
    } catch {
      // Upload failed, return buffer-based result
    }
  }

  return result;
}

module.exports = { storeAsset, uploadAsset };

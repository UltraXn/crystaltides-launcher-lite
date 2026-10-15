import { invoke } from '@tauri-apps/api/core';
import { redact } from '../utils/redact';

/**
 * Dispatches a frontend log message to the Rust backend logger (`~/.crystaltides/logs/launcher.log`).
 * Automatically redacts tokens, credentials, and sensitive parameters before sending.
 */
export const logFrontend = (level: string, msg: string): void => {
  const safeMsg = redact(typeof msg === 'string' ? msg : String(msg ?? ''));
  invoke('log_frontend', { msg: safeMsg, level }).catch(() => {});
};

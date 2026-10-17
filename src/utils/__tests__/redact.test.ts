import { describe, it, expect } from 'vitest';
import { redact } from '../redact';

describe('redact utility', () => {
  it('redacts sensitive keys in JSON payloads', () => {
    const jsonInput = JSON.stringify({
      access_token: 'M.R3_BLA123_SECRET',
      refresh_token: 'M.R3_REFRESH_TOKEN',
      Token: 'xbl_token_value_xyz',
      RpsTicket: 'd=user_ticket_string',
      identityToken: 'XBL3.0 x=12345;xsts_token_value',
      username: 'Notch',
      uuid: '12345678-1234-1234-1234-123456789abc',
    });

    const redacted = redact(jsonInput);
    expect(redacted).not.toContain('M.R3_BLA123_SECRET');
    expect(redacted).not.toContain('M.R3_REFRESH_TOKEN');
    expect(redacted).not.toContain('xbl_token_value_xyz');
    expect(redacted).not.toContain('d=user_ticket_string');
    expect(redacted).not.toContain('XBL3.0 x=12345;xsts_token_value');

    expect(redacted).toContain('"access_token": "[REDACTED]"');
    expect(redacted).toContain('"refresh_token": "[REDACTED]"');
    expect(redacted).toContain('"Token": "[REDACTED]"');
    expect(redacted).toContain('"RpsTicket": "[REDACTED]"');
    expect(redacted).toContain('"identityToken": "[REDACTED]"');
    // Non-sensitive data remains intact
    expect(redacted).toContain('"username":"Notch"');
    expect(redacted).toContain('"uuid":"12345678-1234-1234-1234-123456789abc"');
  });

  it('redacts sensitive keys in query strings and urlencoded bodies', () => {
    const query = 'client_id=my-client&access_token=secret_at_123&scope=XboxLive.SignIn&code=auth_code_999&refresh_token=secret_rt_888';
    const redacted = redact(query);

    expect(redacted).toContain('client_id=my-client');
    expect(redacted).toContain('scope=XboxLive.SignIn');
    expect(redacted).toContain('access_token=[REDACTED]');
    expect(redacted).toContain('code=[REDACTED]');
    expect(redacted).toContain('refresh_token=[REDACTED]');
    expect(redacted).not.toContain('secret_at_123');
    expect(redacted).not.toContain('auth_code_999');
    expect(redacted).not.toContain('secret_rt_888');
  });

  it('redacts --accessToken flag and value in CLI arguments', () => {
    const cli = '--username Steve --version 1.21.1 --accessToken eyJhbGciOiJIUzI1NiJ9.abc.def --gameDir /path';
    const redacted = redact(cli);

    expect(redacted).toContain('--username Steve');
    expect(redacted).toContain('--version 1.21.1');
    expect(redacted).toContain('--accessToken [REDACTED]');
    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiJ9.abc.def');
  });

  it('redacts -Dcrystaltides.ipc.token in JVM args', () => {
    const jvm = '-Xmx4G -Dcrystaltides.ipc.token=super_secret_ipc_token_xyz -Dfile.encoding=UTF-8';
    const redacted = redact(jvm);

    expect(redacted).toContain('-Xmx4G');
    expect(redacted).toContain('-Dcrystaltides.ipc.token=[REDACTED]');
    expect(redacted).toContain('-Dfile.encoding=UTF-8');
    expect(redacted).not.toContain('super_secret_ipc_token_xyz');
  });

  it('redacts JWT tokens anywhere in text', () => {
    const jwt1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Bearer ${jwt1} received in response`;
    const redacted = redact(text);

    expect(redacted).toBe('Bearer [REDACTED] received in response');
    expect(redacted).not.toContain(jwt1);
  });

  it('handles null, empty and non-string values safely', () => {
    expect(redact('')).toBe('');
    // @ts-expect-error testing invalid type
    expect(redact(null)).toBe('');
    // @ts-expect-error testing invalid type
    expect(redact(undefined)).toBe('');
    // @ts-expect-error testing invalid type
    expect(redact(12345)).toBe('12345');
  });
});

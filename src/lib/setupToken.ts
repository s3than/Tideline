import { randomBytes } from 'node:crypto';
import { isJellyfinConfigured } from './jellyfin/client';

const _token: string | null = isJellyfinConfigured()
  ? null
  : (() => {
      const t = randomBytes(16).toString('hex');
      const sep = '='.repeat(52);
      console.log(`\n${sep}`);
      console.log('  TIDELINE — First-run setup token:\n');
      console.log(`  ${t}\n`);
      console.log('  Enter this in the setup wizard to continue.');
      console.log(`${sep}\n`);
      return t;
    })();

export function validateSetupToken(candidate: string): boolean {
  return _token !== null && candidate === _token;
}

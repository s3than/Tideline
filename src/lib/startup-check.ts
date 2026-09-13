import { readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Log the dist folder structure at startup to help diagnose build issues.
 * Runs once when the app starts.
 */
export function logDistStructure(): void {
  try {
    const distPath = join(process.cwd(), 'dist');
    console.log('[startup-check] Checking dist folder structure...');
    console.log('[startup-check] dist path:', distPath);

    try {
      const distContents = readdirSync(distPath);
      console.log('[startup-check] dist/ contents:', distContents.join(', '));

      if (distContents.includes('server')) {
        const serverContents = readdirSync(join(distPath, 'server'));
        console.log('[startup-check] dist/server/ contents:', serverContents.join(', '));
      }

      if (distContents.includes('client')) {
        const clientContents = readdirSync(join(distPath, 'client'));
        console.log('[startup-check] dist/client/ contents:', clientContents.join(', '));

        // Check for API route handlers
        const apiPath = join(distPath, 'client', 'api');
        if (statSync(apiPath).isDirectory()) {
          const apiContents = readdirSync(apiPath);
          console.log('[startup-check] dist/client/api/ contents:', apiContents.join(', '));
        }
      }
    } catch (e) {
      console.error(
        '[startup-check] Error reading dist folder:',
        e instanceof Error ? e.message : String(e),
      );
    }

    // Check if the entry file exists
    const entryPath = join(distPath, 'server', 'entry.mjs');
    try {
      const stat = statSync(entryPath);
      console.log('[startup-check] entry.mjs exists, size:', stat.size, 'bytes');
    } catch (e) {
      console.error(
        '[startup-check] entry.mjs NOT FOUND:',
        e instanceof Error ? e.message : String(e),
      );
    }
  } catch (e) {
    console.error('[startup-check] Fatal error:', e instanceof Error ? e.message : String(e));
  }
}

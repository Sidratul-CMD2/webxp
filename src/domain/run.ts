import type { FsState } from './fs';
import { resolveAddress, type ShellLocation } from './locations';

export type RunApp = 'explorer' | 'calculator' | 'controlPanel' | 'ie' | 'help';

export type RunTarget = { kind: 'app'; app: RunApp } | { kind: 'location'; location: ShellLocation };

const ALLOWLIST: Record<string, RunApp> = {
  explorer: 'explorer',
  calc: 'calculator',
  control: 'controlPanel',
  iexplore: 'ie',
  help: 'help',
};

export const RUN_COMMANDS = Object.keys(ALLOWLIST);

/**
 * Resolves Run input against a fixed allowlist and the virtual folder tree.
 * Input is only ever compared as text; it is never evaluated, executed or
 * used for navigation or network requests.
 */
export function resolveRun(fs: FsState, input: string): RunTarget | null {
  const text = input.trim();
  if (!text || text.length > 260) return null;
  const app = Object.prototype.hasOwnProperty.call(ALLOWLIST, text.toLowerCase()) ? ALLOWLIST[text.toLowerCase()] : undefined;
  if (app) return { kind: 'app', app };
  const location = resolveAddress(fs, text);
  return location ? { kind: 'location', location } : null;
}

export function runErrorMessage(input: string): string {
  return `Windows cannot find '${input.trim()}'. Make sure you typed the name correctly, and then try again. This simulation can run explorer, calc, control, iexplore, help, or open a folder path such as C:\\WINDOWS.`;
}

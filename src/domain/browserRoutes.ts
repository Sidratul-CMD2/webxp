/** Bundled pages for the local Internet Explorer-style shell. No network access. */

export type BrowserRoute = 'welcome' | 'help';

export const ROUTE_ADDRESS: Record<BrowserRoute, string> = {
  welcome: 'about:welcome',
  help: 'about:help',
};

export const ROUTE_TITLE: Record<BrowserRoute, string> = {
  welcome: 'Welcome',
  help: 'Using This Browser',
};

export const HOME_ROUTE: BrowserRoute = 'welcome';

/** A displayed page: a known route, or a local error page for an unrecognized address. */
export type BrowserPage = { route: BrowserRoute } | { route: 'error'; address: string };

export function resolveBrowserAddress(input: string): BrowserPage {
  const text = input.trim().toLowerCase();
  if (text === 'about:welcome' || text === 'about:home' || text === 'welcome') return { route: 'welcome' };
  if (text === 'about:help' || text === 'help') return { route: 'help' };
  return { route: 'error', address: input.trim().slice(0, 2048) };
}

export function pageAddress(page: BrowserPage): string {
  return page.route === 'error' ? page.address : ROUTE_ADDRESS[page.route];
}

export function pageTitle(page: BrowserPage): string {
  return page.route === 'error' ? 'Cannot find server' : ROUTE_TITLE[page.route];
}

import { isLive, type FolderId } from '../domain/fs';
import { LOC, locationTitle } from '../domain/locations';
import { MAX_FAVORITES } from '../domain/prefs';
import { get, pushModal, showError, uid } from './app';
import { updatePrefs } from './sessionActions';

const activeInvoker = () => (document.activeElement instanceof HTMLElement ? document.activeElement : null);

export function promptText(title: string, label: string, value: string, validate?: (text: string) => string | null): Promise<string | null> {
  return new Promise((resolve) => {
    pushModal({
      kind: 'prompt',
      title,
      label,
      value,
      validate: validate ?? ((text) => (text.trim() ? (text.trim().length > 255 ? 'Use 255 characters or fewer.' : null) : 'Type a name.')),
      resolve,
      invoker: activeInvoker(),
      ownerWindowId: get().wm.activeId,
    });
  });
}

export function openAbout(product: string): void {
  pushModal({ kind: 'about', product, invoker: activeInvoker(), ownerWindowId: get().wm.activeId });
}

export function openOrganizeFavorites(): void {
  pushModal({ kind: 'organizeFavorites', invoker: activeInvoker(), ownerWindowId: get().wm.activeId });
}

export function openRunDialog(): void {
  pushModal({ kind: 'run', invoker: activeInvoker(), ownerWindowId: null });
}

/** Favorites are folder bookmarks stored in preferences, never files. */
export async function addFavorite(folderId: FolderId): Promise<void> {
  const s = get();
  if (!isLive(s.fs, folderId)) return;
  if (s.prefs.favorites.length >= MAX_FAVORITES) {
    await showError('Add Favorite', `You can keep up to ${MAX_FAVORITES} favorites. Delete some in Organize Favorites first.`);
    return;
  }
  const name = await promptText('Add Favorite', 'Name:', locationTitle(s.fs, LOC.folder(folderId)));
  if (!name) return;
  updatePrefs((p) => ({ ...p, favorites: [...p.favorites, { id: uid('fav'), name, folderId }] }));
}

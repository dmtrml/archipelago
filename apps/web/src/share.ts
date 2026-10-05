import { track } from './analytics';
import { useGame } from './store';

const siteUrl = import.meta.env.VITE_SITE_URL || location.origin + import.meta.env.BASE_URL;
const url = new URL(siteUrl, location.href);
url.searchParams.set('ref', 'share');

export async function share(text: string) {
  track('share');
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Архипелаг', text, url: url.href });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url.href}`);
    useGame.getState().showToast('Скопировано — вставьте в сообщение или пост', 'good');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    useGame.getState().showToast('Не удалось поделиться', 'bad');
  }
}

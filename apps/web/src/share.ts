import { track } from './analytics';
import { useGame } from './store';
import { getI18n } from './i18n';

export async function share(text: string) {
  const { lang, t } = getI18n();
  const siteUrl = import.meta.env.VITE_SITE_URL || location.origin + import.meta.env.BASE_URL;
  const url = new URL(lang === 'en' ? 'en/' : '', new URL(siteUrl, location.href));
  url.searchParams.set('ref', 'share');
  track('share');
  try {
    if (navigator.share) {
      await navigator.share({ title: t.ui.share.title, text, url: url.href });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url.href}`);
    useGame.getState().showToast(t.ui.share.copied, 'good');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    useGame.getState().showToast(t.ui.share.failed, 'bad');
  }
}

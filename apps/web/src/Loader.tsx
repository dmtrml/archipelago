import { useI18n } from './i18n';

export function Loader() {
  const { t } = useI18n();
  return (
    <div className="app-loader" role="status" aria-label={`${t.meta.app}…`}>
      <svg className="app-loader__icon" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="6" fill="#3E9A9A" />
        <circle cx="17" cy="9" r="4.5" fill="#F5B83D" />
        <path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" fill="none" stroke="#FFFBF3" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M3 21.5c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2" fill="none" stroke="#FFFBF3" strokeOpacity=".55" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <div className="app-loader__title">{t.meta.app}</div>
      <div className="app-loader__track"><span /></div>
    </div>
  );
}

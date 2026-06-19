import { Scale } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export function AppFooter() {
  const { t } = useI18n();

  return (
    <footer className="app-footer">
      <div className="footer-brand">
        <strong>{t('appName')}</strong>
        <span>© 2026 ntrp</span>
      </div>
      <nav className="footer-links" aria-label={t('footerLinks')}>
        <a href="https://github.com/ntrp/hardware-label-generator/blob/main/LICENSE" target="_blank" rel="noreferrer">
          <Scale size={15} />
          {t('license')}
        </a>
      </nav>
    </footer>
  );
}

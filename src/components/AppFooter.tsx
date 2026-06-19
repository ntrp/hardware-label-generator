import { Github, LifeBuoy, Scale } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="footer-brand">
        <strong>Makers Label Generator</strong>
        <span>© 2026 ntrp</span>
      </div>
      <nav className="footer-links" aria-label="Footer links">
        <a href="https://github.com/ntrp/hardware-label-generator" target="_blank" rel="noreferrer">
          <Github size={15} />
          GitHub
        </a>
        <a href="https://github.com/ntrp/hardware-label-generator/issues/new" target="_blank" rel="noreferrer">
          <LifeBuoy size={15} />
          Report issue
        </a>
        <a href="https://github.com/ntrp/hardware-label-generator/blob/main/LICENSE" target="_blank" rel="noreferrer">
          <Scale size={15} />
          MIT License
        </a>
      </nav>
    </footer>
  );
}

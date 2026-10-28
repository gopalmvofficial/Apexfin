import assert from 'node:assert';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Accessibility Audit: CSS contains reduced-motion guardrails', () => {
  const cssPath = path.join(ROOT_DIR, 'src', 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(
    css.includes('@media (prefers-reduced-motion: reduce)'),
    'globals.css must contain prefers-reduced-motion media query for motion-sensitive users'
  );
  assert.ok(
    css.includes('tabular-nums'),
    'globals.css must provide tabular-nums to prevent visual number jitter'
  );
  assert.ok(
    css.includes('safe-area-inset-top'),
    'globals.css must respect iOS safe-area-inset for Dynamic Island and Home Indicator'
  );
});

test('Accessibility Audit: Form inputs enforce 16px minimum on mobile to prevent Safari auto-zoom', () => {
  const cssPath = path.join(ROOT_DIR, 'src', 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(
    css.includes('max(16px'),
    'Form inputs must enforce font-size: max(16px, ...) to prevent iOS Safari auto-zoom'
  );
});

test('Accessibility Audit: Touch targets enforce minimum 44x44pt on coarse pointer screens', () => {
  const cssPath = path.join(ROOT_DIR, 'src', 'app', 'globals.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(
    css.includes('pointer: coarse'),
    'CSS must enforce 44px minimum touch targets on coarse pointer devices (Apple HIG)'
  );
});

test('Accessibility Audit: ARIA roles, landmarks, and labels in core components', () => {
  const pagePath = path.join(ROOT_DIR, 'src', 'app', 'page.tsx');
  const page = fs.readFileSync(pagePath, 'utf-8');

  assert.ok(
    page.includes('role="main"'),
    'Main dashboard must have explicit role="main" landmark'
  );
  assert.ok(
    page.includes('aria-label='),
    'Dashboard sections must feature descriptive aria-labels for assistive screen readers'
  );

  const cardPath = path.join(ROOT_DIR, 'src', 'components', 'HolographicCard3D.tsx');
  const card = fs.readFileSync(cardPath, 'utf-8');
  assert.ok(
    card.includes('role="region"'),
    '3D card must have role="region"'
  );
});

test('Accessibility Audit: PWA Manifest exists and is properly structured', () => {
  const manifestPath = path.join(ROOT_DIR, 'public', 'manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.strictEqual(manifest.display, 'standalone');
  assert.ok(manifest.name.length > 0);
});

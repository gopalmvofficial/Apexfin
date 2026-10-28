import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const apiBackupDir = path.join(rootDir, 'src', 'app', '__api_temp_backup');
const nextConfigPath = path.join(rootDir, 'next.config.ts');
const originalNextConfig = fs.readFileSync(nextConfigPath, 'utf-8');

console.log('==> Preparing Next.js for pure Static Drag-and-Drop Export (out/)...');

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, apiBackupDir);
  }

  const exportConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
`;
  fs.writeFileSync(nextConfigPath, exportConfig, 'utf-8');

  console.log('==> Compiling Next.js 15 static HTML & JS assets into out/ ...');
  execSync('npx next build', { stdio: 'inherit', cwd: rootDir });

  console.log('==> Static output generated successfully in out/ directory!');
} catch (err) {
  console.error('Static export build error:', err);
} finally {
  fs.writeFileSync(nextConfigPath, originalNextConfig, 'utf-8');
  if (fs.existsSync(apiBackupDir)) {
    fs.renameSync(apiBackupDir, apiDir);
  }
  console.log('==> Workspace restored to fullstack server mode.');
}

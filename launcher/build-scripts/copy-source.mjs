/**
 * copy-source.js — 打包前复制源码到launcher
 * 把项目根目录的 src/ 和 scripts/ 复制到 launcher/runtime-dist/
 * 然后安装依赖 + tsc编译
 */
import path from 'node:path';
import fs from 'fs-extra';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const LAUNCHER = path.resolve(import.meta.dirname, '..');
const RUNTIME = path.join(LAUNCHER, 'runtime-dist');

console.log('[copy-source] ROOT:', ROOT);
console.log('[copy-source] LAUNCHER:', LAUNCHER);

// 1. 清理旧构建
if (fs.existsSync(RUNTIME)) {
  fs.rmSync(RUNTIME, { recursive: true, force: true });
}
fs.mkdirSync(RUNTIME, { recursive: true });

// 2. 复制 src/ 和 scripts/
const srcDir = path.join(ROOT, 'src');
const scriptsDir = path.join(ROOT, 'scripts');

if (fs.existsSync(srcDir)) {
  fs.copySync(srcDir, path.join(RUNTIME, 'src'));
  console.log('[copy-source] Copied src/');
}
if (fs.existsSync(scriptsDir)) {
  fs.copySync(scriptsDir, path.join(RUNTIME, 'scripts'));
  console.log('[copy-source] Copied scripts/');
}

// 3. 复制 package.json 和 tsconfig.json（给npm install + tsc用）
const pkg = fs.readJsonSync(path.join(ROOT, 'package.json'));
// 保留 dependencies 和 scripts（打包后需要 start:cli 等脚本）
// 注意：tsx 和 typescript 是 devDependencies，但运行时需要，所以也加入
const minimalPkg = {
  name: pkg.name,
  version: pkg.version,
  type: pkg.type || 'module',
  dependencies: {
    ...(pkg.dependencies || {}),
    tsx: pkg.devDependencies?.tsx || '^4.15.0',
    typescript: pkg.devDependencies?.typescript || '^5.9.3',
  },
  scripts: pkg.scripts || {},
};
fs.writeJsonSync(path.join(RUNTIME, 'package.json'), minimalPkg, { spaces: 2 });

if (fs.existsSync(path.join(ROOT, 'tsconfig.json'))) {
  fs.copySync(path.join(ROOT, 'tsconfig.json'), path.join(RUNTIME, 'tsconfig.json'));
}

// 3b. 复制 .env（打包后APP需要配置文件）
// 注意：不再打包 .env，避免泄露用户私钥
// 首次启动时APP会在userData目录创建空配置文件
/*
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  fs.copySync(envPath, path.join(RUNTIME, '.env'));
  console.log('[copy-source] Copied .env');
}
*/

// 4. 安装依赖
console.log('[copy-source] Installing dependencies...');
execSync('npm install --production', { cwd: RUNTIME, stdio: 'inherit' });

// 4b. 安装跨平台 esbuild 二进制包（tsx 依赖 esbuild，否则 Windows/Linux 运行时找不到对应平台包）
console.log('[copy-source] Installing cross-platform esbuild binaries...');
const esbuildPlatforms = [
  '@esbuild/win32-x64@0.27.2',
  '@esbuild/win32-arm64@0.27.2',
  '@esbuild/linux-x64@0.27.2',
  '@esbuild/linux-arm64@0.27.2',
  '@esbuild/darwin-x64@0.27.2',
  '@esbuild/darwin-arm64@0.27.2',
];
try {
  execSync(`npm install ${esbuildPlatforms.join(' ')} --force --no-save`, { cwd: RUNTIME, stdio: 'inherit' });
  console.log('[copy-source] Cross-platform esbuild binaries installed');
} catch (e) {
  console.log('[copy-source] Warning: failed to install some esbuild binaries:', e.message);
}

// 5. 编译TypeScript
console.log('[copy-source] Compiling TypeScript...');
if (fs.existsSync(path.join(RUNTIME, 'tsconfig.json'))) {
  try {
    execSync('npx tsc', { cwd: RUNTIME, stdio: 'inherit' });
  } catch {
    console.log('[copy-source] tsc had errors, continuing with tsx runtime...');
  }
}

// 6. 复制icon（如果有）
const iconCandidates = ['icon.png', 'icon.icns', 'icon.ico', 'build/icon.png'];
for (const ic of iconCandidates) {
  const p = path.join(ROOT, ic);
  if (fs.existsSync(p)) {
    fs.copySync(p, path.join(LAUNCHER, ic));
    console.log('[copy-source] Copied', ic);
  }
}

console.log('[copy-source] Done!');

/**
 * Robust RPC provider with multi-node fallback
 * Solves TIMEOUT issues caused by blocked/slow BSC nodes
 */

import { JsonRpcProvider } from 'ethers';

// BSC public RPC endpoints — ordered by reliability
const BSC_RPC_FALLBACKS = [
  'https://bsc-dataseed.binance.org/',
  'https://bsc-dataseed1.binance.org/',
  'https://bsc-dataseed2.binance.org/',
  'https://bsc-dataseed3.binance.org/',
  'https://bsc-dataseed4.binance.org/',
  'https://rpc.ankr.com/bsc',
  'https://bscrpc.com',
  'https://1rpc.io/bnb',
  'https://bsc-mainnet.public.blastapi.io',
];

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Create a JsonRpcProvider with automatic fallback.
 * Tests each candidate with a lightweight getNetwork() call.
 */
export async function createRobustProvider(
  customRpcUrl?: string,
  timeoutMs = 15000
): Promise<{ provider: JsonRpcProvider; rpcUrl: string }> {
  const candidates = customRpcUrl
    ? [customRpcUrl, ...BSC_RPC_FALLBACKS]
    : BSC_RPC_FALLBACKS;

  const errors: string[] = [];

  for (const url of candidates) {
    try {
      const provider = new JsonRpcProvider(url);
      const network = await withTimeout(provider.getNetwork(), timeoutMs);
      console.log(`   ✅ RPC connected: ${url} (chainId=${network.chainId})`);
      return { provider, rpcUrl: url };
    } catch (e) {
      const msg = ((e as Error).message || String(e)).slice(0, 120);
      errors.push(`${url}: ${msg}`);
      console.log(`   ⚠️  RPC skip: ${url} — ${msg}`);
    }
  }

  const errorSummary = errors.join('\n     ');
  throw new Error(
    `All RPC endpoints failed.\n     ${errorSummary}\n\n` +
    `═══════════════════════════════════════════════════════\n` +
    `  诊断: BSC RPC 节点全部超时或无法连接\n` +
    `  如果你在中国大陆，BSC 公共节点通常被防火墙阻断。\n\n` +
    `  解决方案（按推荐顺序）:\n` +
    `  1. 在 .env 中设置私有 RPC 节点（推荐）:\n` +
    `     RPC_URL=https://your-quicknode-or-alchemy-endpoint\n\n` +
    `  2. 开启 VPN / 代理，让 Node.js 进程走代理:\n` +
    `     set HTTPS_PROXY=http://127.0.0.1:7890   (Windows CMD)\n` +
    `     $env:HTTPS_PROXY="http://127.0.0.1:7890" (PowerShell)\n\n` +
    `  3. 在境外服务器（香港/新加坡/美国）上运行\n` +
    `═══════════════════════════════════════════════════════`
  );
}

/**
 * Retry wrapper for async RPC operations
 */
export async function withRpcRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 3000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isLast = i === retries - 1;
      if (isLast) break;
      console.log(`   ⏳ RPC retry ${i + 1}/${retries - 1}: ${lastError.message.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastError || new Error('RPC retry exhausted');
}

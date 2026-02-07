/**
 * One-time approvals setup for live trading
 */

import { loadConfig } from './config.js';
import { OrderManager } from './order-manager.js';

async function main() {
  const config = loadConfig();

  if (!config.enableTrading) {
    console.log('⚠️  ENABLE_TRADING is false. You can still run approvals, but live trading remains disabled.');
  }

  const manager = await OrderManager.create(config);

  console.log('🔧 Setting approvals...');
  console.log(`   Maker: ${manager.getMakerAddress()}`);

  const result = await manager.setApprovals();

  if (!result.success) {
    throw new Error('setApprovals returned success=false');
  }

  console.log(`✅ Approvals completed. Transactions: ${result.transactions.length}`);
}

main().catch((error) => {
  console.error('❌ Failed to set approvals:', error?.message || error);
  process.exit(1);
});

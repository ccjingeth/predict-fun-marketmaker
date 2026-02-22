#!/usr/bin/env node
/**
 * 测试激活流程
 */

import { ActivationManager } from '../src/activation.js';

const licenseKey = process.argv[2];
const userId = process.argv[3] || 'test_user';
const userName = process.argv[4] || 'Test User';

if (!licenseKey) {
  console.log('用法: node test-activate.ts <激活码> [用户ID] [用户名]');
  process.exit(1);
}

console.log('\n🔑 测试激活流程');
console.log('='.repeat(50));
console.log(`激活码: ${licenseKey}`);
console.log(`用户ID: ${userId}`);
console.log(`用户名: ${userName}\n`);

async function test() {
  // 1. 检查当前状态
  console.log('1️⃣  检查当前激活状态:');
  const before = ActivationManager.checkActivation();
  console.log(`   状态: ${before.valid ? '✅ 已激活' : '❌ 未激活'}`);
  console.log(`   消息: ${before.message}\n`);

  // 2. 激活许可证
  console.log('2️⃣  激活许可证:');
  const result = await ActivationManager.activateLicense(licenseKey, userId, userName);
  console.log(`   状态: ${result.valid ? '✅ 成功' : '❌ 失败'}`);
  console.log(`   消息: ${result.message}`);

  if (result.valid) {
    console.log(`   剩余天数: ${result.remainingDays} 天`);
    console.log(`   激活信息:`, result.info);
  }
  console.log();

  // 3. 再次检查状态
  console.log('3️⃣  再次检查激活状态:');
  const after = ActivationManager.checkActivation();
  console.log(`   状态: ${after.valid ? '✅ 已激活' : '❌ 未激活'}`);
  console.log(`   消息: ${after.message}`);

  if (after.valid && after.remainingDays) {
    console.log(`   剩余天数: ${after.remainingDays} 天`);
  }
}

test().catch(console.error);

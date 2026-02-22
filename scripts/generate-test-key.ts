#!/usr/bin/env node
/**
 * 快速生成测试激活码（非交互式）
 */

import { ActivationManager } from '../src/activation.js';

const userId = process.argv[2] || 'test_user';
const days = parseInt(process.argv[3]) || 30;

console.log('\n🔑 生成测试激活码');
console.log('='.repeat(50));
console.log(`用户ID: ${userId}`);
console.log(`有效期: ${days} 天`);

const licenseKey = ActivationManager.generateLicenseKey(userId, 'Test User', days);

console.log('\n✅ 激活码:');
console.log(licenseKey);
console.log('\n使用方法:');
console.log(`  npm run activate ${licenseKey}\n`);

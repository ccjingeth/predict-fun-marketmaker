#!/usr/bin/env node
/**
 * 测试套利机器人激活检查
 */

import { ActivationManager } from '../src/activation.js';

console.log('\n🔑 测试套利机器人激活检查');
console.log('='.repeat(70));

// 检查激活
const activation = ActivationManager.checkActivation();

if (!activation.valid) {
  console.log('\n' + '='.repeat(70));
  console.log('⚠️  套利模块需要激活码才能使用');
  console.log('='.repeat(70));
  console.log('\n📋 功能说明:');
  console.log('   ✅ 做市商模块 - 完全免费，可正常使用');
  console.log('   ❌ 套利模块 - 需要激活码才能使用');
  console.log('\n' + '−'.repeat(70));
  console.log('❌ 错误:', activation.message);
  console.log('\n🔑 如何获取激活码:');
  console.log('   1. 联系管理员获取激活码');
  console.log('   2. 运行激活命令: npm run activate <激活码>');
  console.log('   3. 或使用交互式激活: npm run activate');
  console.log('\n💡 其他命令:');
  console.log('   npm run activate:check  - 查看激活状态');
  console.log('   npm run activate:clear  - 清除激活（测试用）');
  console.log('   npm run activate:quick  - 快速生成测试激活码');
  console.log('\n' + '='.repeat(70) + '\n');

  process.exit(1);
}

// 显示激活信息
if (activation.info && activation.remainingDays !== undefined) {
  console.log('\n✅ 套利模块已激活');
  console.log('👤 用户:', activation.info.userName);
  console.log('🆔 用户ID:', activation.info.userId);
  console.log('⏰ 剩余天数:', activation.remainingDays, '天');
  console.log('🔑 功能:', activation.info.features.join(', '));
  console.log('\n✅ 激活验证通过，可以启动套利机器人\n');
}

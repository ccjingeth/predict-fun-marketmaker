#!/usr/bin/env node
/**
 * 激活码管理工具
 *
 * 使用方法：
 * npm run activate
 * npm run activate:validate <激活码>
 * npm run activate:clear
 */

import * as readline from 'readline';
import { ActivationManager } from '../src/activation.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🔑 Predict.fun 套利模块激活工具');
  console.log('='.repeat(60));

  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'check') {
    // 检查当前激活状态
    const result = ActivationManager.checkActivation();

    console.log('\n当前激活状态:');
    console.log(`状态: ${result.valid ? '✅ 已激活' : '❌ 未激活'}`);
    console.log(`消息: ${result.message}`);

    if (result.valid && result.info) {
      console.log(`\n激活信息:`);
      console.log(`激活码: ${result.info.licenseKey.substring(0, 20)}...`);
      console.log(`用户: ${result.info.userName}`);
      console.log(`到期日期: ${new Date(result.info.expireDate).toLocaleDateString()}`);
      console.log(`剩余天数: ${result.remainingDays} 天`);
    }

  } else if (command) {
    // 直接激活（提供激活码作为参数）
    const licenseKey = command;

    console.log(`\n正在激活: ${licenseKey}`);

    const userId = await question('请输入用户ID: ');
    const userName = await question('请输入用户名: ');

    const result = await ActivationManager.activateLicense(licenseKey, userId, userName);

    console.log('\n激活结果:');
    console.log(`状态: ${result.valid ? '✅ 成功' : '❌ 失败'}`);
    console.log(`消息: ${result.message}`);

    if (result.valid) {
      console.log(`\n🎉 激活成功！`);
      console.log(`有效期: ${result.remainingDays} 天`);
      console.log(`\n您现在可以使用套利模块了`);
    }

  } else {
    // 交互式激活
    console.log('\n请选择操作:');
    console.log('1. 激活许可证');
    console.log('2. 检查激活状态');
    console.log('3. 退出');

    const choice = await question('\n请选择 (1-3): ');

    switch (choice) {
      case '1': {
        const licenseKey = await question('请输入激活码: ');
        const userId = await question('请输入用户ID: ');
        const userName = await question('请输入用户名: ');

        const result = await ActivationManager.activateLicense(licenseKey, userId, userName);

        console.log('\n激活结果:');
        console.log(`状态: ${result.valid ? '✅ 成功' : '❌ 失败'}`);
        console.log(`消息: ${result.message}`);

        if (result.valid) {
          console.log(`\n🎉 激活成功！有效期: ${result.remainingDays} 天`);
        }
        break;
      }

      case '2': {
        const result = ActivationManager.checkActivation();

        console.log('\n当前激活状态:');
        console.log(`状态: ${result.valid ? '✅ 已激活' : '❌ 未激活'}`);
        console.log(`消息: ${result.message}`);

        if (result.valid && result.info) {
          console.log(`\n激活信息:`);
          console.log(`到期日期: ${new Date(result.info.expireDate).toLocaleDateString()}`);
          console.log(`剩余天数: ${result.remainingDays} 天`);
        }
        break;
      }

      case '3':
        console.log('\n👋 再见！');
        break;

      default:
        console.log('\n❌ 无效选择');
    }
  }

  rl.close();
}

main().catch(console.error);

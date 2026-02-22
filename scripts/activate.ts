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

  if (command === 'validate') {
    // 验证激活码
    const licenseKey = args[1];
    if (!licenseKey) {
      console.error('\n❌ 错误: 请提供激活码');
      console.log('用法: npm run activate:validate XXXX-XXXX-XXXX-XXXX-XXXX');
      process.exit(1);
    }

    const result = ActivationManager.validateLicenseKey(licenseKey);

    console.log('\n验证结果:');
    console.log(`状态: ${result.valid ? '✅ 有效' : '❌ 无效'}`);
    console.log(`消息: ${result.message}`);

    if (result.valid && result.info) {
      console.log(`\n激活信息:`);
      console.log(`用户: ${result.info.userName}`);
      console.log(`用户ID: ${result.info.userId}`);
      console.log(`到期日期: ${new Date(result.info.expireDate).toLocaleDateString()}`);
      console.log(`剩余天数: ${result.remainingDays} 天`);
      console.log(`功能: ${result.info.features.join(', ')}`);
    }

  } else if (command === 'clear') {
    // 清除激活
    console.log('\n⚠️  警告: 这将清除当前激活状态');
    const confirm = await question('确定要清除吗？(yes/no): ');

    if (confirm.toLowerCase() === 'yes') {
      ActivationManager.clearActivation();
      console.log('✅ 激活信息已清除');
    } else {
      console.log('已取消');
    }

  } else if (command === 'generate') {
    // 开发者工具：生成测试激活码
    console.log('\n⚠️  开发者模式：生成测试激活码');

    const userId = await question('请输入用户ID (默认: test_user): ') || 'test_user';
    const daysInput = await question('请输入有效天数 (默认: 30): ') || '30';
    const days = parseInt(daysInput);

    const licenseKey = ActivationManager.generateLicenseKey(userId, 'Test User', days);

    console.log('\n✅ 测试激活码已生成:');
    console.log(licenseKey);
    console.log(`\n用户ID: ${userId}`);
    console.log(`有效期: ${days} 天`);
    console.log('\n使用方法:');
    console.log(`npm run activate ${licenseKey}`);

  } else if (command === 'check') {
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
    console.log('2. 验证激活码');
    console.log('3. 检查激活状态');
    console.log('4. 清除激活');
    console.log('5. 退出');

    const choice = await question('\n请选择 (1-5): ');

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
        const licenseKey = await question('请输入激活码: ');
        const result = ActivationManager.validateLicenseKey(licenseKey);

        console.log('\n验证结果:');
        console.log(`状态: ${result.valid ? '✅ 有效' : '❌ 无效'}`);
        console.log(`消息: ${result.message}`);

        if (result.valid && result.remainingDays !== undefined) {
          console.log(`剩余天数: ${result.remainingDays} 天`);
        }
        break;
      }

      case '3': {
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

      case '4': {
        const confirm = await question('确定要清除激活吗？(yes/no): ');
        if (confirm.toLowerCase() === 'yes') {
          ActivationManager.clearActivation();
          console.log('✅ 激活信息已清除');
        } else {
          console.log('已取消');
        }
        break;
      }

      case '5':
        console.log('\n👋 再见！');
        break;

      default:
        console.log('\n❌ 无效选择');
    }
  }

  rl.close();
}

main().catch(console.error);

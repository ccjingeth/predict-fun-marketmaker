#!/usr/bin/env node

/**
 * macOS 公证脚本
 *
 * 注意：如果没有Apple开发者账号，此脚本会跳过公证步骤
 * 用户需要右键点击应用选择"打开"来绕过Gatekeeper
 */

require('dotenv').config({ path: '../.env' });

const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    // 非macOS平台，跳过
    return;
  }

  // 检查是否有Apple开发者账号配置
  const hasAppleId = process.env.APPLE_ID && process.env.APPLE_ID_PASSWORD;
  const hasTeamId = process.env.APPLE_TEAM_ID;

  if (!hasAppleId || !hasTeamId) {
    console.log('⚠️  未配置Apple开发者账号，跳过公证步骤');
    console.log('⚠️  用户需要右键点击应用选择"打开"来运行');
    console.log('');
    console.log('📝 要启用自动公证，请设置以下环境变量:');
    console.log('   APPLE_ID=your@email.com');
    console.log('   APPLE_ID_PASSWORD=app-specific-password');
    console.log('   APPLE_TEAM_ID=your-team-id');
    return;
  }

  // 有Apple开发者账号，执行公证
  const appName = context.packager.appInfo.productFilename;

  return await notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_ID_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};

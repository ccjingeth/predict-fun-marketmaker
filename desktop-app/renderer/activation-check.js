// ==================== 激活码检查功能 ====================

/**
 * 检查套利模块激活状态
 */
async function checkArbitrageActivation() {
  try {
    // 直接调用 Node.js 子进程检查激活状态
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const process = spawn('node', ['--import', 'tsx', '-e', `
        const { ActivationManager } = require('./src/activation.js');
        const result = ActivationManager.checkActivation();
        console.log(JSON.stringify(result));
      `], {
        stdio: ['pipe', 'pipe', 'inherit'],
        cwd: process.cwd().replace('desktop-app/renderer', ''),
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          updateActivationUI(result);
          resolve(result);
        } catch {
          resolve({
            valid: false,
            message: '未激活',
          });
        }
      });
    });

  } catch (error) {
    console.error('激活检查失败:', error);
    return {
      valid: false,
      message: '激活检查失败',
    };
  }
}

/**
 * 激活许可证
 */
async function activateLicense(licenseKey: string) {
  try {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const userId = 'user_' + Date.now();
      const userName = '用户';

      const process = spawn('node', ['--import', 'tsx', '-e', `
        const { ActivationManager } = require('./src/activation.js');
        ActivationManager.activateLicense('${licenseKey}', '${userId}', '${userName}')
          .then(result => console.log(JSON.stringify(result)))
          .catch(err => console.log(JSON.stringify({valid: false, message: err.message})));
      `], {
        stdio: ['pipe', 'pipe', 'inherit'],
        cwd: process.cwd().replace('desktop-app/renderer', ''),
      });

      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          updateActivationUI(result);
          resolve(result);
        } catch {
          resolve({
            valid: false,
            message: '激活失败',
          });
        }
      });
    });

  } catch (error) {
    return {
      valid: false,
      message: `激活失败: ${error.message}`,
    };
  }
}

/**
 * 更新激活状态UI
 */
function updateActivationUI(activation) {
  const statusEl = document.getElementById('activationStatus');
  const messageEl = document.getElementById('activationMessage');
  const sectionEl = document.getElementById('activationSection');

  if (!statusEl || !messageEl || !sectionEl) {
    return;
  }

  if (activation.valid) {
    statusEl.textContent = `✅ 已激活 (${activation.remainingDays}天)`;
    statusEl.style.color = '#34d399';

    messageEl.textContent = '';
    messageEl.style.display = 'none';

    // 更改区块样式为已激活
    sectionEl.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)';
    sectionEl.style.borderColor = 'rgba(16, 185, 129, 0.1)';

  } else {
    statusEl.textContent = '❌ 未激活';
    statusEl.style.color = '#f87171';

    messageEl.textContent = activation.message;
    messageEl.style.display = 'block';
  }
}

/**
 * 初始化激活码功能
 */
function initActivation() {
  const activateBtn = document.getElementById('activateBtn');
  const licenseKeyInput = document.getElementById('licenseKeyInput');

  if (activateBtn && licenseKeyInput) {
    activateBtn.addEventListener('click', async () => {
      const licenseKey = licenseKeyInput.value.trim();

      if (!licenseKey) {
        const messageEl = document.getElementById('activationMessage');
        if (messageEl) {
          messageEl.textContent = '❌ 请输入激活码';
          messageEl.style.display = 'block';
        }
        return;
      }

      // 禁用按钮
      activateBtn.textContent = '激活中...';
      activateBtn.disabled = true;

      try {
        const result = await activateLicense(licenseKey);

        if (result.valid) {
          licenseKeyInput.value = '';
          logger.debug('激活成功:', result);

          // 3秒后重新加载页面
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        } else {
          const messageEl = document.getElementById('activationMessage');
          if (messageEl) {
            messageEl.textContent = `❌ ${result.message}`;
            messageEl.style.display = 'block';
          }
        }

      } catch (error) {
        logger.error('激活失败:', error);
        const messageEl = document.getElementById('activationMessage');
        if (messageEl) {
          messageEl.textContent = `❌ 激活失败: ${error.message}`;
          messageEl.style.display = 'block';
        }
      } finally {
        activateBtn.textContent = '激活';
        activateBtn.disabled = false;
      }
    });
  }

  // 页面加载时检查激活状态
  checkArbitrageActivation();
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initActivation);
} else {
  initActivation();
}

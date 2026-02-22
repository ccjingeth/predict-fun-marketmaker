/**
 * 激活码验证系统
 * 保护套利模块不被未授权使用
 */

import * as crypto from 'crypto';

/**
 * 激活码信息
 */
export interface ActivationInfo {
  activated: boolean;
  licenseKey: string;
  userId: string;
  userName: string;
  expireDate: number;
  machineId: string;
  features: string[];
  activatedAt: number;
}

/**
 * 激活码验证结果
 */
export interface ValidationResult {
  valid: boolean;
  message: string;
  info?: ActivationInfo;
  remainingDays?: number;
}

/**
 * 激活码管理器
 */
export class ActivationManager {
  private static readonly SECRET_KEY = 'PREDICT_FUN_ARBITRAGE_2025_SECRET';
  private static readonly ACTIVATION_FILE = '.arbitrage_activation.json';
  private activationInfo: ActivationInfo | null = null;

  /**
   * 生成机器ID（基于硬件信息）
   */
  private static generateMachineId(): string {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();

    // 获取第一个 MAC 地址
    let mac = 'unknown';
    for (const name of Object.keys(networkInterfaces)) {
      const nets = networkInterfaces[name];
      for (const net of nets) {
        if (net.mac && mac === 'unknown') {
          mac = net.mac;
          break;
        }
      }
      if (mac !== 'unknown') break;
    }

    // 组合机器信息生成唯一ID
    const machineInfo = `${os.platform()}-${os.arch()}-${mac}`;
    return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
  }

  /**
   * 生成激活码
   */
  static generateLicenseKey(userId: string, userName: string, days: number = 365): string {
    const machineId = this.generateMachineId();
    const expireDate = Date.now() + days * 24 * 60 * 60 * 1000;

    const data = {
      userId,
      userName,
      machineId,
      expireDate,
      features: ['arbitrage', 'auto_trading'],
      timestamp: Date.now(),
    };

    // 加密数据
    const jsonString = JSON.stringify(data);
    const encrypted = crypto.createHash('sha256')
      .update(jsonString + this.SECRET_KEY)
      .digest('hex');

    // 生成激活码格式: XXXX-XXXX-XXXX-XXXX-XXXX
    const licenseKey = [
      encrypted.substring(0, 4),
      encrypted.substring(4, 8),
      encrypted.substring(8, 12),
      encrypted.substring(12, 16),
      encrypted.substring(16, 20),
      encrypted.substring(20, 24),
      encrypted.substring(24, 28),
      encrypted.substring(28, 32),
    ].join('-').toUpperCase();

    return licenseKey;
  }

  /**
   * 验证激活码
   */
  static validateLicenseKey(licenseKey: string): ValidationResult {
    try {
      // 基本格式验证
      const format = /^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/;
      if (!format.test(licenseKey)) {
        return {
          valid: false,
          message: '激活码格式无效',
        };
      }

      // 读取保存的激活信息
      const savedInfo = this.loadActivationInfo();

      if (!savedInfo || savedInfo.licenseKey !== licenseKey) {
        return {
          valid: false,
          message: '激活码未绑定到此机器',
        };
      }

      // 检查过期时间
      const now = Date.now();
      if (savedInfo.expireDate < now) {
        return {
          valid: false,
          message: '激活码已过期',
        };
      }

      // 检查机器ID
      const currentMachineId = this.generateMachineId();
      if (savedInfo.machineId !== currentMachineId) {
        return {
          valid: false,
          message: '激活码与当前机器不匹配',
        };
      }

      // 计算剩余天数
      const remainingDays = Math.floor((savedInfo.expireDate - now) / (24 * 60 * 60 * 1000));

      return {
        valid: true,
        message: '激活码有效',
        info: savedInfo,
        remainingDays,
      };

    } catch (error) {
      return {
        valid: false,
        message: '激活码验证失败',
      };
    }
  }

  /**
   * 激活许可证
   */
  static async activateLicense(
    licenseKey: string,
    userId: string,
    userName: string
  ): Promise<ValidationResult> {
    try {
      // 格式验证
      const format = /^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/;
      if (!format.test(licenseKey)) {
        return {
          valid: false,
          message: '激活码格式无效',
        };
      }

      // 在线验证（可选，这里先简化为本地验证）
      const onlineValidation = await this.validateOnline(licenseKey, userId);
      if (!onlineValidation.valid) {
        return onlineValidation;
      }

      // 生成本地激活信息
      const machineId = this.generateMachineId();
      const activationInfo: ActivationInfo = {
        activated: true,
        licenseKey,
        userId,
        userName,
        expireDate: Date.now() + 365 * 24 * 60 * 60 * 1000, // 默认1年
        machineId,
        features: ['arbitrage', 'auto_trading'],
        activatedAt: Date.now(),
      };

      // 保存激活信息
      this.saveActivationInfo(activationInfo);

      const remainingDays = 365;

      return {
        valid: true,
        message: '激活成功！',
        info: activationInfo,
        remainingDays,
      };

    } catch (error) {
      return {
        valid: false,
        message: `激活失败: ${error instanceof Error ? error.message : '未知错误'}`,
      };
    }
  }

  /**
   * 在线验证激活码
   */
  private static async validateOnline(
    licenseKey: string,
    userId: string
  ): Promise<ValidationResult> {
    // TODO: 实现服务器端验证
    // 这里暂时跳过在线验证，直接返回成功
    // 实际使用时应该调用您的激活服务器

    return {
      valid: true,
      message: '在线验证通过',
    };

    /* 在线验证示例：
    try {
      const response = await fetch('https://your-server.com/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, userId }),
      });

      const result = await response.json();
      return result;
    } catch {
      return {
        valid: false,
        message: '无法连接到激活服务器',
      };
    }
    */
  }

  /**
   * 检查激活状态
   */
  static checkActivation(): ValidationResult {
    const savedInfo = this.loadActivationInfo();

    if (!savedInfo || !savedInfo.activated) {
      return {
        valid: false,
        message: '未激活',
      };
    }

    return this.validateLicenseKey(savedInfo.licenseKey);
  }

  /**
   * 保存激活信息
   */
  private static saveActivationInfo(info: ActivationInfo): void {
    const fs = require('fs');
    const path = require('path');

    try {
      const filePath = path.join(process.cwd(), this.ACTIVATION_FILE);
      fs.writeFileSync(filePath, JSON.stringify(info, null, 2), 'utf-8');
    } catch (error) {
      console.error('保存激活信息失败:', error);
    }
  }

  /**
   * 加载激活信息
   */
  private static loadActivationInfo(): ActivationInfo | null {
    const fs = require('fs');
    const path = require('path');

    try {
      const filePath = path.join(process.cwd(), this.ACTIVATION_FILE);
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * 清除激活信息（用于测试或重新激活）
   */
  static clearActivation(): void {
    const fs = require('fs');
    const path = require('path');

    try {
      const filePath = path.join(process.cwd(), this.ACTIVATION_FILE);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('清除激活信息失败:', error);
    }
  }

  /**
   * 获取激活信息
   */
  static getActivationInfo(): ActivationInfo | null {
    return this.loadActivationInfo();
  }
}

/**
 * 为开发者提供的工具：生成测试激活码
 */
export function generateTestLicense(userId: string = 'test_user', days: number = 30): string {
  return ActivationManager.generateLicenseKey(userId, 'Test User', days);
}

/**
 * 激活码保护中间件
 */
export function requireActivation(target: any, propertyKey: string): any {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop === propertyKey) {
        const validation = ActivationManager.checkActivation();

        if (!validation.valid) {
          throw new Error(
            `套利模块需要激活码才能使用\n` +
            `错误: ${validation.message}\n` +
            `请联系管理员获取激活码\n` +
            `或运行: npm run activate`
          );
        }
      }
      return obj[prop];
    },
  });
}

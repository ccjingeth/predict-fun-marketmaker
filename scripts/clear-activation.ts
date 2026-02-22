#!/usr/bin/env node
/**
 * 清除激活状态（非交互式）
 */

import { ActivationManager } from '../src/activation.js';

ActivationManager.clearActivation();
console.log('✅ 激活信息已清除\n');

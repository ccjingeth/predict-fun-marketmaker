# 双版本启动指南

## 📌 两个版本说明

### 完整版 (index.html)
- **适合**: 高级用户、需要套利功能的用户
- **功能**: 做市商 + 套利机器人 + 完整配置选项
- **界面**: 7个卡片、50+按钮、30个开关
- **复杂度**: ⭐⭐⭐⭐⭐

### 简化版 (index_simple.html)
- **适合**: 小白用户、专注积分获取的用户
- **功能**: 做市商（积分优化）+ 精简配置
- **界面**: 5个卡片、15个按钮、3个开关
- **复杂度**: ⭐⭐

---

## 🚀 启动方法

### 方法1：使用 npm 脚本（推荐）

#### 启动完整版
```bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npm start
# 或
npm run dev
```

#### 启动简化版
```bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npm run start:simple
# 或
npm run dev:simple
```

### 方法2：直接使用 electron

#### 启动完整版
```bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npx electron .
```

#### 启动简化版
```bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npx electron . --simple
# 或
npx electron . -s
```

---

## 📊 版本对比

| 功能 | 完整版 | 简化版 |
|------|--------|--------|
| **做市商** | ✅ | ✅ |
| **套利机器人** | ✅ | ❌ |
| **执行指标（30+个）** | ✅ | ❌ |
| **跨平台映射** | ✅ | ❌ |
| **依赖约束** | ✅ | ❌ |
| **策略开关** | 30个 | 3个 |
| **日志过滤** | 14种分类 | 3种分类 |
| **配置标签** | 3个 | 1个 |
| **一键最佳实践** | ✅ | ✅ |
| **智能建议** | ✅ | ✅ |
| **积分状态** | ✅ | ✅ |

---

## 🎯 小白推荐流程

### 第1步：启动简化版
```bash
npm run start:simple
```

### 第2步：检查配置
打开控制台后，查看"配置检查"区域，确认：
- ✅ API_KEY 已配置
- ✅ PRIVATE_KEY 已配置

### 第3步：一键优化
点击 **"✨ 一键最佳实践"** 按钮

### 第4步：保存配置
点击 **"保存配置"** 按钮

### 第5步：启动做市商
点击 **"启动做市商"** 按钮

### 第6步：监控积分
查看"积分状态"和"做市指标"区域

---

## 💡 切换版本

### 从完整版切换到简化版
```bash
# 停止当前运行的完整版
# 然后启动简化版
npm run start:simple
```

### 从简化版切换到完整版
```bash
# 停止当前运行的简化版
# 然后启动完整版
npm start
```

---

## 📝 配置文件共享

**重要**：两个版本共享同一个配置文件！
- 环境变量：`../.env`
- 做市指标：`userData/mm-metrics.json`

这意味着：
1. 你在简化版中修改的配置，完整版也会看到
2. 可以先用简化版配置，再切换到完整版查看更多指标

---

## 🔧 自定义启动

### 创建桌面快捷方式（macOS）

#### 简化版快捷方式
创建 `/Applications/PredictFun-Simple.command`:
```bash
#!/bin/bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npm run start:simple
```

然后赋予权限：
```bash
chmod +x /Applications/PredictFun-Simple.command
```

#### 完整版快捷方式
创建 `/Applications/PredictFun-Full.command`:
```bash
#!/bin/bash
cd /Users/cc/Desktop/CC/predict-fun-market-maker/desktop-app
npm start
```

然后赋予权限：
```bash
chmod +x /Applications/PredictFun-Full.command
```

---

## 🆚 如何选择版本？

### 使用简化版，如果你：
- ✅ 只想获取积分
- ✅ 是小白用户
- ✅ 觉得界面太复杂
- ✅ 不需要套利功能

### 使用完整版，如果你：
- ✅ 需要套利功能
- ✅ 是高级用户
- ✅ 需要详细的执行指标
- ✅ 需要跨平台套利

---

## 📞 需要帮助？

- **Discord**: https://discord.gg/predictdotfun
- **文档**: `/docs/BEGINNER_GUIDE_CN.md`
- **简化指南**: `/docs/SIMPLIFICATION_GUIDE.md`

---

## 🎉 总结

**推荐小白用户使用简化版**：
- 界面清晰（-70%按钮）
- 操作简单（-90%开关）
- 专注积分
- 一键优化

**启动命令**：
```bash
npm run start:simple  # 简化版（推荐）
npm start             # 完整版
```

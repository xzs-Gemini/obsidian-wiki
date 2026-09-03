---
tags: [ projects, XR, unity, environment, privacy-safe ]
publish: true
---


# XR 与 Unity 环境

## 项目抽象

一个基于 Unity 6、XR Interaction Toolkit、OpenXR 与 VR Builder 的训练/流程项目，先完成官方基线和环境验收，再进入业务阶段。

## 你的工作思路

### 1. 把“安装完成”和“运行基线通过”分开

编辑器安装、Hub 注册、项目打开、包安装、Demo 编译、OpenXR Runtime、模拟器输入、真实设备都是不同门槛。每一层通过后才能向下一层推进。

### 2. 先跑官方 Demo

新框架先用官方 Demo 验证版本、依赖和关键交互，再做自定义业务。这能把环境问题与业务代码问题分离。

### 3. 建立兼容矩阵

记录 Unity 版本、VR Builder 版本、Process Engine、XRI、OpenXR、Input System、构建模块、Windows Runtime 和目标硬件。不要只看单个包的“已安装”。

### 4. 明确模拟与真机证据

官方 Mock HMD/XR Device Simulator 可证明流程、输入和条件转换在模拟环境工作，但不能写成 PICO/头显真机验收。报告必须保留“真机未验证”。

## 主要坑

- Unity Hub CDN/校验可能失败，需要验证官方安装包签名与校验值，再走手动安装。
- UAC 和软件协议接受必须由用户参与，不能把被取消写成安装错误。
- 缺少 OpenXR 活动 Runtime 时，包和场景都正常也无法完成真实 XR 条件。
- 缺少 Android Build Support 不影响 Windows 模拟基线，但会阻塞后续设备构建。
- 老项目使用旧 Unity 版本时，不能为赶进度直接强制升级并宣称兼容。

## 推荐阶段门

```text
Phase 0A 静态审计
→ Phase 0B 官方 Demo 运行验收
→ Phase 0C 模拟器条件流程
→ Phase 1 业务原型
→ 设备构建
→ 真机验收
```

每一阶段都要写“已证明什么”和“尚未证明什么”。

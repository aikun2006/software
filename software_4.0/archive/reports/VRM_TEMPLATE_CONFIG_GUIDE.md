# VRM数字人模板配置说明文档

## 1. 模板文件信息

### 1.1 基本信息
- **文件名**: `puppy护士 1 侧边灰 arkit校正.vrm`
- **模型作者**: 墨海徽
- **原始设计**: @恩慈_ENCY
- **版本**: 1.0.0
- **模型路径**: `/static/avatars/puppy护士 1 侧边灰 arkit校正.vrm`

### 1.2 模型特点
- ✅ 支持52键位ARKit表情键
- ✅ 支持面部捕捉同步人脸表情
- ✅ 基于VRM 1.0标准
- ✅ 优化的骨骼结构
- ✅ 高质量纹理贴图

---

## 2. 配置参数详解

### 2.1 模型变换配置

```typescript
{
  scale: 1.5,              // 缩放比例 (0.1-10)
  position: {              // 世界坐标位置
    x: 0,
    y: -1.2,              // Y轴偏移，-1.2使模型居中显示
    z: 0
  },
  rotation: {              // 初始旋转角度
    x: 0,
    y: 0,
    z: 0
  }
}
```

**配置说明**:
- **缩放比例1.5**: 经过测试，此比例下模型在UI中显示效果最佳
- **Y轴偏移-1.2**: 使模型底部对齐画面中心偏下位置
- **零旋转**: 初始面向前方，与默认相机视角匹配

### 2.2 ARKit表情配置

```typescript
{
  arkitConfig: {
    enabled: true,
    expressionKeys: [
      'blink',           // 普通眨眼
      'blinkLeft',       // 左眼眨眼
      'blinkRight',      // 右眼眨眼
      'happy',           // 开心
      'angry',           // 生气
      'sad',             // 难过
      'surprised',       // 惊讶
      'neutral',         // 自然
      'smile',           // 微笑
      'thinking',        // 思考
      'sleepy',          // 困倦
      'relaxed'         // 放松
    ]
  }
}
```

**支持的ARKit表情键**:
| 表情名称 | 说明 | 数值范围 |
|---------|------|---------|
| blink | 普通眨眼 | 0-1 |
| blinkLeft | 左眼眨眼 | 0-1 |
| blinkRight | 右眼眨眼 | 0-1 |
| happy | 开心/大笑 | 0-1 |
| angry | 生气 | 0-1 |
| sad | 难过 | 0-1 |
| surprised | 惊讶 | 0-1 |
| neutral | 自然/无表情 | 0-1 |
| smile | 微笑 | 0-1 |
| thinking | 思考 | 0-1 |
| sleepy | 困倦 | 0-1 |
| relaxed | 放松 | 0-1 |

### 2.3 材质配置

```typescript
{
  materialConfig: {
    transparent: true,   // 启用透明
    side: 2              // 2=THREE.DoubleSide, 渲染双面
  }
}
```

**材质优化**:
- **透明启用**: 允许材质透明渲染，适配各种背景
- **双面渲染**: 确保从背面观看时也能正常显示

### 2.4 动画配置

```typescript
{
  animationConfig: {
    idleAnimation: 'Idle',           // 空闲动画名称
    transitionDuration: 0.3         // 动画过渡时长(秒)
  }
}
```

**动画系统**:
- 支持VRM内置动画
- 平滑的动画过渡
- 自动循环播放

### 2.5 光照配置

```typescript
{
  lightingConfig: {
    ambientIntensity: 0.6,      // 环境光强度 (0-1)
    directionalIntensity: 0.8,  // 主光强度 (0-1)
    fillLightIntensity: 0.4     // 补光强度 (0-1)
  }
}
```

**光照策略**:
- **环境光0.6**: 提供基础照明，避免阴影过暗
- **主光0.8**: 模拟自然光源，创造立体感
- **补光0.4**: 填充阴影区域，提升细节可见性

---

## 3. 骨骼结构

### 3.1 人体骨骼 (VRM Humanoid)

模型使用标准VRM人形骨骼系统，包括：

| 骨骼类别 | 骨骼数量 | 说明 |
|---------|---------|------|
| 头部 | 3 | Head, Neck, Eyes |
| 手臂 | 6×2 | 左手、左腕、左肩等 |
| 腿部 | 6×2 | 左大腿、左膝、左踝等 |
| 躯干 | 4 | Spine, Chest, UpperChest, Hips |
| 手指 | 5×2 | 每手5根手指 |

### 3.2 骨骼动画

支持以下骨骼动画：
- ✅ 头部旋转和倾斜
- ✅ 手臂自然摆动
- ✅ 身体呼吸动画
- ✅ 手部精细动作

---

## 4. 渲染配置

### 4.1 WebGL渲染器设置

```javascript
{
  alpha: true,                      // 透明背景
  antialias: true,                  // 抗锯齿
  powerPreference: 'high-performance',  // 高性能模式
  preserveDrawingBuffer: true        // 保留绘制缓冲
}
```

### 4.2 渲染管线优化

| 参数 | 值 | 说明 |
|-----|-----|------|
| outputColorSpace | SRGBColorSpace | 标准色彩空间 |
| toneMapping | ACESFilmicToneMapping | 电影级色调映射 |
| toneMappingExposure | 1.0 | 曝光值 |

### 4.3 材质属性

| 属性 | 值 | 说明 |
|-----|-----|------|
| transparent | true | 启用透明 |
| side | DoubleSide | 双面渲染 |
| frustumCulled | true | 视锥体裁剪优化 |

---

## 5. 纹理贴图

### 5.1 纹理类型

| 纹理类型 | 用途 | 格式 |
|---------|------|------|
| 主纹理(map) | 颜色/细节 | PNG/JPEG |
| 法线贴图(normalMap) | 表面细节 | PNG |
| 高光贴图(specularMap) | 光泽度 | PNG |

### 5.2 纹理优化

- ✅ 使用MipMap优化远距离渲染
- ✅ 纹理压缩减少内存占用
- ✅ 延迟加载非必要纹理

---

## 6. 性能配置

### 6.1 自适应质量系统

```typescript
{
  high: {    // 高端设备
    antialias: true,
    pixelRatio: 2,
    frameRate: 60
  },
  medium: {  // 中端设备
    antialias: true,
    pixelRatio: 1.5,
    frameRate: 45
  },
  low: {     // 低端设备
    antialias: false,
    pixelRatio: 1,
    frameRate: 30
  }
}
```

### 6.2 优化技术

- ✅ 按需渲染(仅在需要时渲染)
- ✅ 视锥体裁剪
- ✅ 骨骼蒙皮优化
- ✅ 实例化渲染(如有重复模型)

---

## 7. 使用指南

### 7.1 基本使用

```vue
<template>
  <DigitalAvatar3D
    :model-url="'/static/avatars/puppy护士 1 侧边灰 arkit校正.vrm'"
    :show-performance-info="true"
    :auto-load="true"
    @expressionChange="onExpressionChange"
    @modelLoad="onModelLoad"
  />
</template>
```

### 7.2 表情控制

```javascript
const avatarRef = ref(null)

// 设置表情
avatarRef.value?.setExpression('happy')

// 开始说话(触发动画)
avatarRef.value?.startSpeaking()

// 停止说话
avatarRef.value?.stopSpeaking()

// 设置情绪(快捷方式)
avatarRef.value?.setEmotion('positive') // happy
avatarRef.value?.setEmotion('negative') // sad
avatarRef.value?.setEmotion('neutral')   // neutral
```

### 7.3 性能监控

```javascript
avatarRef.value?.getInitReport()      // 获取初始化报告
avatarRef.value?.getCacheStats()      // 获取缓存统计
avatarRef.value?.retryLoad()          // 重新加载模型
```

---

## 8. 验证与调试

### 8.1 自动验证

组件会自动进行以下验证：
- ✅ VRM模型完整性检查
- ✅ 配置参数匹配验证
- ✅ 表情系统可用性检测
- ✅ 骨骼结构验证

### 8.2 控制台输出

加载时会输出以下信息：
```
VRM模型配置已应用:
- 缩放比例: 1.5
- 位置: {x: 0, y: -1.2, z: 0}
- 材质透明: true

ARKit表情系统已启用
可用的表情: [表情列表]

VRM模型加载耗时: xxxms
```

### 8.3 调试模式

启用性能信息显示：
```vue
<DigitalAvatar3D :show-performance-info="true" />
```

显示内容：
- 总初始化时间
- 当前帧率
- 模型加载时间
- 当前加载阶段

---

## 9. 常见问题

### 9.1 模型不显示
- 检查模型路径是否正确
- 确认VRM文件存在
- 检查浏览器控制台错误

### 9.2 表情不工作
- 确认模型支持表情系统
- 检查expressionManager是否初始化
- 查看控制台表情系统状态

### 9.3 性能问题
- 降低渲染质量配置
- 启用按需渲染
- 减少纹理分辨率

### 9.4 动画卡顿
- 检查骨骼权重配置
- 优化关键帧数量
- 降低渲染分辨率

---

## 10. 授权说明

**重要提醒**：
- ❌ 禁止色情、暴力、政治宗教相关使用
- ❌ 禁止未授权的商用行为
- ❌ 禁止二次发布和倒卖
- ✅ 允许制作视频和直播使用
- ✅ 允许使用挂件滤镜
- ✅ b站使用无需标注作者，其他平台需标注

**联系方式**：
- QQ: 2640344313
- 微信: Xcsy_001

---

**文档版本**: v1.0.0
**最后更新**: 2026年5月24日
**维护者**: AI Assistant

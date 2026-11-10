# 向日葵和情绪向日葵 · 微信小游戏

《向日葵和情绪向日葵》微信小游戏版：

- **情绪向日葵**：浇水、晒太阳、摸摸、说话，六种情绪、成长值、昼夜与本地存档
- **向日葵三维模型**：旋转、双指缩放、切换视角

## 与网页版的区别

| 项目 | 网页版 | 小游戏版 |
| --- | --- | --- |
| 运行方式 | 浏览器打开 HTML | 微信小游戏（`game.js` + WebGL） |
| 界面 | HTML/CSS DOM | Canvas 2D 绘制后作为纹理叠加在 3D 上 |
| 存档 | `localStorage` | `wx.setStorageSync`（键名一致） |
| 输入 | `<input>` | `wx.showKeyboard` |
| STL 导出 | 支持 | 暂不支持（小游戏内没有文件分享通道） |
| 模型 / 情绪 | 同一套 `model/sunflower.js` 与数值 | 同一套 |

## 导入到微信开发者工具

1. 打开微信开发者工具 → 导入项目。
2. 目录选择 **本文件夹（`minigame/`）**。
3. AppID 已填为 `wx17676b750ff057c1`（如需换账号，在项目设置或 `project.config.json` 里改）。
4. 编译类型应为「小游戏 / game」，导入后直接点「编译」。

> 没有小游戏账号时，也可以先用开发者工具的测试号体验，但上传体验版需要正式 AppID。

## 操作

- **首页**：点两张卡片分别进入情绪向日葵 / 三维模型。
- **情绪向日葵**
  - 底部四个按钮：浇水、晒太阳、摸摸、说话。
  - 直接点花头也会触发「摸摸」。
  - 拖动画面旋转视角；右上角切换昼夜、查看说明。
  - 说话面板可以直接点快捷短语，也可以调起键盘输入。
  - 首次进入有玩法说明；右上角 `?` 里可以清空存档。
- **三维模型**
  - 拖动旋转、双指缩放；停止操作 2 秒后自动旋转。
  - 底部切换全身 / 花头 / 侧面 / 花托，自动旋转开关。

## 目录结构

```text
minigame/
├─ game.js                 入口
├─ game.json               小游戏配置
├─ project.config.json     开发者工具项目配置（compileType: game）
└─ js/
   ├─ main.js              启动、模式路由、主循环、输入分发
   ├─ platform.js          屏幕 / 存储 / 触摸 / 键盘 / 生命周期适配
   ├─ scene-host.js        WebGL 渲染宿主（背景 → 3D → UI 三层）
   ├─ ui.js                Canvas UI 纹理与按钮命中
   ├─ theme.js             配色、文字、图标、圆角等绘制工具
   ├─ texture.js           Canvas → DataTexture（带上下翻转）
   ├─ face.js              花盘表情绘制
   ├─ emotion-data.js      情绪、数值、台词、离线衰减
   ├─ emotion-scene.js     花盆 / 花 / 灯光 / 表情 / 水滴 / 相机
   ├─ viewer-scene.js      三维查看器的取景与交互
   ├─ modes/home.js        首页
   ├─ modes/emotion.js     情绪向日葵的界面与玩法
   ├─ modes/viewer.js      三维查看器的界面
   ├─ workers/
   │  └─ index.js          占位 Worker（当前逻辑全在主线程，仅满足工具编译）
   └─ lib/
      ├─ threejs-miniprogram.js   微信官方 three.js 适配层
      ├─ sunflower.js             程序化向日葵模型（含 rig 模式）
      └─ threejs-miniprogram.LICENSE
```

## 联调时建议重点看

1. **首屏**：首页是否正常渲染；点两张卡片能否进入、返回。
2. **3D**：花瓣、花盘、花盆是否正常；旋转/缩放手感；阴影是否过暗。
3. **UI 清晰度**：文字在 2x/3x 屏是否清晰；底部面板是否被安全区/胶囊挡住。
4. **键盘**：说话时输入框是否被键盘挡住（代码会随键盘高度上移面板）。
5. **存档**：杀进程重进后成长值、情绪是否保留；隔天回来的离线衰减。
6. **性能**：低端机若卡顿，可以把 `js/emotion-scene.js` 里花瓣数/小花数下调，或在 `js/ui.js` 里把 `platform.dpr * 0.8` 改成 `platform.dpr * 0.6`。

如果出现黑屏，请先看开发者工具 Console 的报错；常见原因是基础库过低（建议 2.30+）、WebGL 初始化失败或 `createOffscreenCanvas` 不支持。

## 控制台提示说明

- **「小程序基础库从 3.7.0 起正式支持 HarmonyOS 平台…」**：微信基础库自身的公告，来自 `WAGame.js`，不是游戏报错，可忽略。
- **「Multiple readback operations using getImageData are faster with the willReadFrequently…」**：Chromium 的性能建议，已通过给离屏画布加 `willReadFrequently: true`、并让表情纹理按需上传处理。
- **「worker path empty」**：部分开发者工具版本会尝试编译小游戏 Worker 包，若 `game.json` 没有 `workers` 配置就报这个错。工程已在 `game.json` 里加入 `"workers": "workers"` 和占位入口 `workers/index.js`，正常情况下不会再出现；如果工具仍报，可重启开发者工具或清一下编译缓存。

## 发布提示

- 需要**小游戏账号**（个人主体可注册，上线通常需要软著等资质，具体以微信最新规则为准）。
- 类目按实际内容选择（休闲 / 养成）。
- 开发者工具里「上传」→ 微信公众平台「版本管理」→ 提交审核 → 发布。
- 当前包体约 0.71 MB（three.js 适配层 0.59 MB + 模型 43 KB + 业务代码），远低于小游戏主包限制。
- 小游戏对外名称在微信公众平台后台设置；本工程内的首页文案、分享标题与 `projectname` 已统一为「向日葵和情绪向日葵」。

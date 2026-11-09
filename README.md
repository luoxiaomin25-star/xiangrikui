# 向日葵 · 小小花园

线上地址：<https://luoxiaomin25-star.github.io/xiangrikui/>（GitHub Pages，推送到 `main` 自动发布）

一个入口页，收着两件向日葵作品：

- **向日葵三维模型**（`sunflower.html`）— 程序化生成的实体向日葵，可旋转、缩放、调形态参数、导出 STL。98,076 个三角面，9 个部件。
- **情绪向日葵 v0.1**（`emotion-sunflower.html`）— 一盆会看脸色的向日葵：浇水、晒太阳、摸摸、说话，六种情绪，带成长值、昼夜切换与本地存档。

两个游戏都是**单文件、离线可玩**：不联网、不需要服务器，双击 HTML 就能打开，手机浏览器同样可用。

---

## 目录

| 文件 / 目录 | 说明 |
| --- | --- |
| `index.html` | 导航页（网站首页），两张游戏卡片 |
| `sunflower.html` | 向日葵三维查看器 |
| `emotion-sunflower.html` | 情绪向日葵游戏 |
| `preview-full.png`、`emotion-intro.png` | 导航页的两张缩略图（16:10 裁切） |
| `model/`、`game/`、`web/`、`tools/`、`build.js` | 模型、查看器、游戏源码与构建脚本 |
| `weapp/` | 原生微信小程序工程 |
| `deploy/` | 可直接整包上传的静态托管副本（与根目录同款） |
| `游戏说明.md` | 情绪向日葵的玩法、六种情绪、代码结构 |
| `发布指南.md` | 网页托管、小程序注册/提审/发布的完整步骤 |

模型导出的大文件（`sunflower.stl`、`sunflower-print.stl`、`sunflower.obj` 等）体积较大，没有入库，需要时运行 `node build.js` 在本机生成。

---

## 加一款新游戏

1. **把游戏做成单文件**：新建 `新游戏.html`，样式、脚本、素材尽量内联；双击用浏览器打开确认能玩。
2. **放进同一个目录**：和 `index.html` 平级（放在子目录也可以，卡片里写相对路径，如 `games/新游戏.html`）。
3. **复制一张卡片**：打开 `index.html`，找到 `<main class="garden">` 里的注释，复制一整个 `<a class="card">…</a>` 块，改 7 处：

   | 位置 | 改成 |
   | --- | --- |
   | `href="…"` | 新游戏的文件名 |
   | `<span class="badge">` | 类型标签，如「解谜 · 单文件」 |
   | `<span class="index">` | 编号，如 `03` |
   | `<h2>` | 游戏名 |
   | `<p>` | 一句话简介 |
   | `<div class="tags">` | 三个小标签 |
   | `<code>` | 文件名（显示在卡片底部） |

4. **缩略图（可选）**：放一张 16:10 的图片（建议 1600×1000）到同目录，把 `<img src="…">` 指向它。**不放图也能用**：删掉 `<img>` 那行，卡片会自动显示渐变 + 🌻 占位。
5. **收尾**：按需更新 `<ul class="stats">` 和页脚；网格是自适应的，2～4 张卡片都会自动排好，不用改 CSS。

可直接复制的最小卡片模板：

```html
<a class="card card--pet" href="新游戏.html" aria-label="打开新游戏 新游戏.html">
  <figure class="thumb">
    <span class="badge">类型 · 标签</span>
    <span class="index">03</span>
    <img src="新游戏预览.png" alt="新游戏预览" loading="lazy" onerror="this.closest('.thumb').classList.add('no-img')">
    <span class="fallback" aria-hidden="true">🌻</span>
  </figure>
  <div class="body">
    <h2>新游戏</h2>
    <p>一句话说清玩什么、怎么玩。</p>
    <div class="tags"><span>标签一</span><span>标签二</span><span>标签三</span></div>
    <div class="go"><code>新游戏.html</code><span class="arrow" aria-hidden="true">→</span></div>
  </div>
</a>
```

---

## 部署

### GitHub Pages（已启用，推荐）

推送到 `main` 就自动更新，不需要手动上传：

```bash
git add -A && git commit -m "更新游戏" && git push
```

访问 <https://luoxiaomin25-star.github.io/xiangrikui/>，1～2 分钟后生效；强制刷新（Ctrl+F5）可跳过缓存。

### 其他静态托管 / 手动上传

**要上传的文件（放同一目录、文件名不变）：**

```text
index.html                 ← 导航页，必须有
sunflower.html             ← 三维模型，必须有
emotion-sunflower.html     ← 情绪游戏，必须有
preview-full.png           ← 缩略图，建议传
emotion-intro.png          ← 缩略图，建议传
```

- **三件套缺一不可**：少了 `index.html` 就没有导航页；少了任意一个游戏文件，对应卡片会 404。
- **两张缩略图**：不传不会坏——卡片会降级成渐变 + 🌻 占位，按钮仍可点，只是不好看。
- **更新游戏**：替换同名文件即可，链接不变，不用改 `index.html`。
- `deploy/` 文件夹里已经是同款五件套，图省事可以整个拖到托管平台。

### 微信小程序

`weapp/` 是原生小程序工程，用微信开发者工具导入即可；注册、提审、发布步骤见 `发布指南.md`。

---

## 三维模型

程序化生成的向日葵（Helianthus annuus）三维模型：一株带茎、叶、花头的完整切花，所有部件都是封闭实体，可直接切片打印。

- 三角面 98,076；9 个部件：茎、茎毛、花托、花盘小花、瘦果、舌状花、总苞片、叶片、叶柄
- 花盘小花按黄金角 137.5078° 的 Fermat 螺旋排布（斐波那契螺旋）
- 舌状花两轮，基部橘黄、尖端淡黄，横截面浅槽状并带纵向脉纹
- 叶片为心形，具锯齿边缘、隆起主脉与羽状侧脉
- 自检：全部部件为闭合流形，0 退化面、0 未闭合边、0 非流形边（`node build.js` 可复现）

`model/sunflower.js` 另有 `rig: true` 模式：花头以花梗为枢轴，42 片花瓣各自独立，供情绪游戏做开合、下垂、炸毛等动画；默认模式不变，不影响 STL 导出与小程序。

## 重新生成

```bash
node build.js             # 导出 stl / obj / mtl，并打印自检报告
node tools/make-html.js   # 打包 sunflower.html（并同步 deploy/）
node tools/make-game.js   # 打包 emotion-sunflower.html
```

`build.js` 支持参数覆盖，例如 `node build.js --headTilt=40 --diskRadius=9`；在 `sunflower.html` 里也可以实时调整花头倾角、花盘直径、茎高、花瓣数、小花数量与叶片数，点「下载 STL」导出当前形态。

## 3D 打印提示

主模型是 1:1 比例（花头直径约 29 cm、整株高 58 cm），适合大幅面打印机；普通家用打印机请用 `sunflower-print.stl`（高 200 mm），或自行缩放后把花瓣、叶片厚度调到 0.4 mm 以上。

/* 把会话内嵌片段包进一个带主题变量的测试页，验证 CDN 加载与 WebGL 初始化
 * 用法：node tools/test-fragment.js [片段路径]
 */
const fs = require('fs');
const path = require('path');

const frag = process.argv[2] ||
  'C:/Users/86186/.codex/visualizations/2026/09/18/01a0b335-af18-73e3-9389-66cb075cbe54/sunflower-3d.html';
const out = path.join(__dirname, '..', '.tmp-edge', 'fragtest.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>片段测试</title>
<style>
:root{--background:#1b1d1a;--foreground:#eae7de;--card:#242722;--card-foreground:#eae7de;
--muted:#2c2f29;--muted-foreground:#a8a49a;--border:#3a3e36;--primary:#e5b53f;--primary-foreground:#241d06;
--accent:#33372e;--accent-foreground:#eae7de;}
body{background:var(--background);color:var(--foreground);margin:0;padding:24px;
font:14px/1.5 -apple-system,"Segoe UI","Microsoft YaHei",system-ui,sans-serif}
.text-small{font-size:12px}
</style></head>
<body>
${fs.readFileSync(frag, 'utf8')}
</body></html>`;
fs.writeFileSync(out, html);
console.log('wrote ' + out + '  ' + (html.length / 1024).toFixed(0) + ' KB');

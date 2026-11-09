/* 把最新的模型代码同步到小程序工程
 * 用法：node tools/sync-weapp.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const from = path.join(root, 'model', 'sunflower.js');
const to = path.join(root, 'weapp', 'lib', 'sunflower.js');
fs.copyFileSync(from, to);
console.log('synced:', path.relative(root, from), '->', path.relative(root, to));

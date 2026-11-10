/* 占位 Worker 入口
 *
 * 当前版本的所有逻辑都在主线程运行，没有使用 wx.createWorker。
 * 这个文件与 game.json 里的 "workers": "workers" 一起，
 * 用于满足微信开发者工具编译 Worker 包的要求（否则部分工具版本会报
 * "worker path empty"）。后续如果要做多线程计算，可以在这里扩展。
 */
worker.onMessage(function () {
  worker.postMessage({ type: 'ready' });
});

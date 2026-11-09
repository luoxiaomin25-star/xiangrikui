const { createScopedThreejs } = require('../../lib/threejs-miniprogram.js');
const { createMiniViewer } = require('../../lib/mini-viewer.js');

const VIEWS = [
  { key: 'full', label: '全身' },
  { key: 'head', label: '花头' },
  { key: 'side', label: '侧面' },
  { key: 'back', label: '花托' }
];

function statsText(model) {
  const st = model.stats;
  return st.parts + ' 个部件 · ' + st.triangles + ' 面 · 高 '
    + Math.round(st.size.y * 10) + ' mm';
}

Page({
  data: {
    views: VIEWS,
    current: 'full',
    auto: true,
    stats: '正在构建模型…',
    ready: false
  },

  onReady() {
    this.initViewer();
  },

  initViewer() {
    wx.createSelectorQuery()
      .in(this)
      .select('#sunflower')
      .node()
      .exec((res) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          this.setData({ stats: '画布初始化失败，请检查基础库版本' });
          return;
        }
        try {
          this.canvas = canvas;
          const THREE = createScopedThreejs(canvas);
          const info = wx.getSystemInfoSync();
          this.viewer = createMiniViewer(THREE, canvas, canvas.width, canvas.height, {
            autoRotate: true,
            pixelRatio: Math.min(info.pixelRatio || 1, 2)
          });
          this.setData({
            stats: statsText(this.viewer.getModel()),
            ready: true
          });
          if (wx.onWindowResize) {
            this._onResize = () => this.handleResize();
            wx.onWindowResize(this._onResize);
          }
        } catch (err) {
          console.error('[sunflower] init failed', err);
          this.setData({
            stats: '初始化失败：' + (err && err.message ? err.message : String(err))
          });
        }
      });
  },

  handleResize() {
    if (!this.viewer) return;
    wx.createSelectorQuery()
      .in(this)
      .select('#sunflower')
      .boundingClientRect((rect) => {
        if (rect && rect.width && rect.height) {
          this.viewer.resize(rect.width, rect.height);
        }
      })
      .exec();
  },

  onView(e) {
    const key = e.currentTarget.dataset.key;
    if (!this.viewer || !key || key === this.data.current) return;
    this.viewer.frame(key);
    this.setData({ current: key });
  },

  onToggleRotate() {
    if (!this.viewer) return;
    const next = !this.data.auto;
    this.viewer.setAutoRotate(next);
    this.setData({ auto: next });
  },

  onReseed() {
    if (!this.viewer) return;
    this.viewer.setParams({ seed: Math.floor(Math.random() * 1000000000) });
    this.setData({ stats: statsText(this.viewer.getModel()) });
    wx.showToast({ title: '换了一株', icon: 'none', duration: 900 });
  },

  onTouchStart(e) {
    this.viewer && this.viewer.touchStart(e.touches);
  },

  onTouchMove(e) {
    this.viewer && this.viewer.touchMove(e.touches);
  },

  onTouchEnd(e) {
    this.viewer && this.viewer.touchEnd(e.touches);
  },

  onHide() {
    if (this.viewer) this.viewer.pause();
  },

  onShow() {
    if (this.viewer) this.viewer.resume();
  },

  onUnload() {
    if (this.viewer) this.viewer.pause();
    if (this._onResize && wx.offWindowResize) {
      wx.offWindowResize(this._onResize);
    }
  },

  onShareAppMessage() {
    return {
      title: '看看这株程序化生成的 3D 向日葵',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    return {
      title: '程序化生成的 3D 向日葵 · 单指旋转、双指缩放'
    };
  }
});

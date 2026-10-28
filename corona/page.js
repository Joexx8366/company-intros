/* ==========================================================================
   日冕机器人 RIMBOT · 招聘特辑 —— 页面自有逻辑
   引擎零改动：只读它发布的 --sc-p，写自己的 class 与自定义属性。
   ========================================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var body = doc.body;

  var narrow = matchMedia('(max-width: 900px)');
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  function isFlat() { return narrow.matches || calm.matches; }

  /* ── 0 · 窄屏 / 减弱动效：钉住幕降级为流式，内容一张不少 ──────────── */
  function degrade() {
    if (!isFlat()) return;
    var secs = doc.querySelectorAll('[data-sc-act="pin"]');
    for (var i = 0; i < secs.length; i++) {
      secs[i].setAttribute('data-sc-act', 'flow');
      secs[i].removeAttribute('data-sc-span');
    }
  }
  degrade();

  var mergeSec = doc.querySelector('.sp--merge');
  var joinSec = doc.querySelector('.sp--join');

  /* ── 1 · 签名动作：误差收敛带 ────────────────────────────────────────
     左半是模型预测的轨迹（平滑、理想），右半是产线实测的轨迹（带真实抖动）。
     两者之间夹一条误差带。滚动推进时整条带子收窄；沿 x 轴越往右越贴合，
     因为右边代表「现在」。收束点上写的是现场披露的真实指标。
     路径由本页自己按幕进度重算，引擎只负责发布 --sc-p。               */
  var N = 72, VBW = 1000, VBH = 320, MID = 160;
  var bandEl = doc.querySelector('.gap__band');
  var predEl = doc.querySelector('.gap__pred');
  var realEl = doc.querySelector('.gap__real');
  var gapEl = doc.querySelector('.gap');
  var hasGap = bandEl && predEl && realEl;

  // 固定的一组伪随机相位，保证每次生成同一条曲线（不用 Math.random）
  var PH = [0.0, 1.7, 3.1, 4.6, 5.9, 2.3, 0.8, 3.9, 5.2, 1.1, 4.2, 2.8];

  function buildGap(p) {
    // 全局幅度：p=0 时缝很宽，p=1 时收到最窄
    var ampMax = 74 * (1 - p) + 3.0 * p;
    var pred = [], real = [], band = [];

    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var x = t * VBW;

      // 预测：模型在隐空间里的理想轨迹，平滑
      var py = MID + Math.sin(t * Math.PI * 2.15 + 0.4) * 30
                   + Math.sin(t * Math.PI * 4.6) * 7;

      // 实测：叠加多重噪声，模拟力触觉抖动、标定误差、通信延迟
      var n = 0;
      for (var k = 0; k < PH.length; k++) {
        n += Math.sin(t * (7.3 + k * 2.11) * Math.PI + PH[k]) * (1 / (k + 1.6));
      }
      n /= 0.72;

      // 沿 x 轴越往右越贴合（右边是「现在」），滚动推进整体再收一层
      var taper = Math.pow(1 - t, 1.25);
      var ry = py + n * ampMax * taper;

      pred.push([x, py]);
      real.push([x, ry]);
    }

    var d = function (pts) {
      var s = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
      for (var i = 1; i < pts.length; i++) s += 'L' + pts[i][0].toFixed(2) + ',' + pts[i][1].toFixed(2);
      return s;
    };

    // 误差带 = 预测线正向 + 实测线反向闭合
    band = pred.concat(real.slice().reverse());

    predEl.setAttribute('d', d(pred));
    realEl.setAttribute('d', d(real));
    bandEl.setAttribute('d', d(band) + 'Z');
  }

  /* ── 2 · 分界线 chrome：证明进度 + 收尾时的合流 ──────────────────── */
  var dv = doc.querySelector('.dv');
  var lastPct = 50;

  // 只动收尾幕自己的 --splitpct，以及固定分界线的 --dvleft。
  // 绝不能写 :root 的 --splitpct —— 那是全局变量，会把每一幕的左栏都压窄。
  function setSplit(pct) {
    if (Math.abs(pct - lastPct) < 0.02) return;
    lastPct = pct;
    var v = pct.toFixed(2) + '%';
    root.style.setProperty('--dvleft', v);
    if (joinSec) joinSec.style.setProperty('--splitpct', v);
  }

  // 收尾幕的滚动区间 —— 分界线在这里从 50% 走到 0%（右栏占满）
  function joinRange() {
    if (!joinSec) return null;
    var top = joinSec.offsetTop;
    var h = joinSec.offsetHeight;
    var vh = window.innerHeight;
    // pin 幕：进入视口即开始，幕走完（top + h - vh）结束
    return { from: top - vh * 0.55, to: top + h - vh };
  }

  function frame() {
    // 全局进度：分界线上的那条橙线
    var vh = window.innerHeight;
    var max = Math.max(1, doc.documentElement.scrollHeight - vh);
    var pg = Math.min(1, Math.max(0, window.scrollY / max));
    root.style.setProperty('--pg', pg.toFixed(4));

    // 合流
    var r = joinRange();
    if (r && dv) {
      var t = (window.scrollY - r.from) / Math.max(1, r.to - r.from);
      t = Math.min(1, Math.max(0, t));
      // 缓入缓出，收尾那一下要果断
      var e = t * t * (3 - 2 * t);
      setSplit(50 * (1 - e));
      var closing = t > 0.45;
      if (closing !== body.classList.contains('is-closing')) body.classList.toggle('is-closing', closing);
      dv.classList.toggle('is-collapsed', t > 0.9);
    }

    // 签名动作跟随峰值幕进度
    if (hasGap) {
      var p = 0;
      if (mergeSec) {
        // 引擎把 --sc-p 写成内联自定义属性，直接读比重算样式快
        var raw = mergeSec.style.getPropertyValue('--sc-p');
        if (raw) p = Math.min(1, Math.max(0, parseFloat(raw) || 0));
      }
      if (isFlat()) p = 0;   // 降级时给整条带的完整形态（左宽右窄），让"缝在收窄"这件事照样看得见；给 1 会收成一条直线，等于把签名动作删了
      if (p !== lastGapP) {
        lastGapP = p;
        buildGap(p);
        if (gapEl) gapEl.setAttribute('data-gap-p', p.toFixed(3));
      }
    }

    requestAnimationFrame(frame);
  }
  var lastGapP = -1;

  /* ── 3 · 点击复制微信号 ──────────────────────────────────────────── */
  var cpc = doc.querySelector('.cpc');
  if (cpc) {
    cpc.addEventListener('click', function () {
      var val = cpc.getAttribute('data-copy') || '';
      var done = function () {
        cpc.classList.add('is-done');
        var h = cpc.querySelector('.cpc__hint');
        if (h) { h.textContent = '已复制'; }
        setTimeout(function () {
          cpc.classList.remove('is-done');
          if (h) h.textContent = '点击复制';
        }, 2200);
      };
      var fallback = function () {
        var ta = doc.createElement('textarea');
        ta.value = val;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        doc.body.appendChild(ta);
        ta.select();
        try { doc.execCommand('copy'); done(); } catch (e) { /* 交给用户手动选 */ }
        doc.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(done).catch(fallback);
      } else {
        fallback();
      }
    });
  }

  /* ── 4 · 启动 ────────────────────────────────────────────────────── */
  if (hasGap) buildGap(isFlat() ? 0 : 0);
  requestAnimationFrame(frame);

  // 从窄屏切回宽屏时要恢复 pin —— 直接刷新是最稳的
  var wasFlat = isFlat();
  var onResize = function () {
    if (isFlat() !== wasFlat) location.reload();
  };
  if (narrow.addEventListener) narrow.addEventListener('change', onResize);
  else if (narrow.addListener) narrow.addListener(onResize);
  if (calm.addEventListener) calm.addEventListener('change', onResize);
  else if (calm.addListener) calm.addListener(onResize);
})();

"""把渲染结果降采样成字符图并统计色彩分布，用于无图像界面下的造型检查。
用法: python tools/inspect.py preview.png [宽=100]
"""
import sys
from PIL import Image
import colorsys


def classify(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    deg = h * 360
    if v < 0.16:
        return '.'          # 背景/阴影
    if s < 0.16 and v < 0.34:
        return '.'
    if 40 <= deg <= 68 and s > 0.35 and v > 0.35:
        return 'Y'          # 花瓣黄
    if 30 <= deg < 40 and s > 0.45:
        return 'o'          # 橙黄小花
    if 68 <= deg <= 165 and s > 0.15:
        return 'G'          # 茎叶绿
    if 10 <= deg < 40 and v < 0.55:
        return 'b'          # 种子褐
    if s < 0.2:
        return ':'          # 灰白高光
    return '?'


def main(path, width=100):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    step = max(1, W // width)
    rows, cols = H // step // 2, W // step
    px = im.load()
    counts = {}
    minx, miny, maxx, maxy = W, H, -1, -1
    art = []
    for ry in range(rows):
        line = ''
        for rx in range(cols):
            r = g = b = n = 0
            for y in range(ry * step * 2, min(H, (ry + 1) * step * 2), 2):
                for x in range(rx * step, min(W, (rx + 1) * step), 2):
                    pr, pg, pb = px[x, y]
                    r += pr; g += pg; b += pb; n += 1
            if not n:
                continue
            r //= n; g //= n; b //= n
            ch = classify(r, g, b)
            counts[ch] = counts.get(ch, 0) + 1
            if ch not in '.':
                minx = min(minx, rx); maxx = max(maxx, rx)
                miny = min(miny, ry); maxy = max(maxy, ry)
            line += ch
        art.append(line)
    print(f'图像 {W}x{H}  字符网格 {cols}x{rows}')
    total = sum(counts.values())
    keys = sorted(counts, key=lambda k: -counts[k])
    print('色彩占比: ' + '  '.join(f'{k}={counts[k]*100//max(1,total)}%' for k in keys))
    if maxx >= 0:
        print(f'模型字符范围 x {minx}-{maxx} ({100*(maxx-minx)//cols}%宽)  '
              f'y {miny}-{maxy} ({100*(maxy-miny)//rows}%高)')
    print()
    for line in art:
        print(line)


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 100)

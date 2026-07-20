(() => {
  'use strict';

  function makeCanvas(width, height = width) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function hexToRgb(hex) {
    const number = parseInt(String(hex || '#000000').replace('#', ''), 16) || 0;
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function rgba(hex, alpha) {
    const color = hexToRgb(hex);
    return `rgba(${color.r},${color.g},${color.b},${alpha})`;
  }

  function morphAlpha(alpha, width, height, radius, useMaximum) {
    if (!radius) return alpha;
    const horizontal = new Uint8ClampedArray(alpha.length);
    const output = new Uint8ClampedArray(alpha.length);
    const choose = useMaximum ? Math.max : Math.min;

    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      for (let x = 0; x < width; x += 1) {
        let value = useMaximum ? 0 : 255;
        for (let scan = Math.max(0, x - radius); scan <= Math.min(width - 1, x + radius); scan += 1) {
          value = choose(value, alpha[row + scan]);
        }
        horizontal[row + x] = value;
      }
    }

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = useMaximum ? 0 : 255;
        for (let scan = Math.max(0, y - radius); scan <= Math.min(height - 1, y + radius); scan += 1) {
          value = choose(value, horizontal[scan * width + x]);
        }
        output[y * width + x] = value;
      }
    }
    return output;
  }

  function blurAlpha(alpha, width, height, radius) {
    if (!radius) return alpha;
    const horizontal = new Uint8ClampedArray(alpha.length);
    const output = new Uint8ClampedArray(alpha.length);

    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      let sum = 0;
      let count = 0;
      for (let x = 0; x <= Math.min(width - 1, radius); x += 1) {
        sum += alpha[row + x];
        count += 1;
      }
      for (let x = 0; x < width; x += 1) {
        horizontal[row + x] = Math.round(sum / Math.max(1, count));
        const remove = x - radius;
        const add = x + radius + 1;
        if (remove >= 0) {
          sum -= alpha[row + remove];
          count -= 1;
        }
        if (add < width) {
          sum += alpha[row + add];
          count += 1;
        }
      }
    }

    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let y = 0; y <= Math.min(height - 1, radius); y += 1) {
        sum += horizontal[y * width + x];
        count += 1;
      }
      for (let y = 0; y < height; y += 1) {
        output[y * width + x] = Math.round(sum / Math.max(1, count));
        const remove = y - radius;
        const add = y + radius + 1;
        if (remove >= 0) {
          sum -= horizontal[remove * width + x];
          count -= 1;
        }
        if (add < height) {
          sum += horizontal[add * width + x];
          count += 1;
        }
      }
    }
    return output;
  }

  function removeSmallIslands(alpha, width, height, maximumSize) {
    if (!maximumSize) return;
    const total = width * height;
    const seen = new Uint8Array(total);
    const queue = new Int32Array(total);

    for (let start = 0; start < total; start += 1) {
      if (seen[start] || alpha[start] <= 16) continue;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      seen[start] = 1;

      while (head < tail) {
        const pixel = queue[head++];
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        const visit = (next) => {
          if (seen[next] || alpha[next] <= 16) return;
          seen[next] = 1;
          queue[tail++] = next;
        };
        if (x > 0) visit(pixel - 1);
        if (x + 1 < width) visit(pixel + 1);
        if (y > 0) visit(pixel - width);
        if (y + 1 < height) visit(pixel + width);
      }

      if (tail <= maximumSize) {
        for (let index = 0; index < tail; index += 1) alpha[queue[index]] = 0;
      }
    }
  }

  function removeBlackMatte(pixels, alpha, width, height, edgeWidth, strength) {
    if (!edgeWidth || strength <= 0) return;
    const total = width * height;
    const distance = new Uint8Array(total);
    distance.fill(255);
    const queue = new Int32Array(total);
    let head = 0;
    let tail = 0;

    for (let pixel = 0; pixel < total; pixel += 1) {
      if (alpha[pixel] <= 8) {
        distance[pixel] = 0;
        queue[tail++] = pixel;
      }
    }

    while (head < tail) {
      const pixel = queue[head++];
      const nextDistance = distance[pixel] + 1;
      if (nextDistance > edgeWidth) continue;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const visit = (next) => {
        if (nextDistance >= distance[next]) return;
        distance[next] = nextDistance;
        queue[tail++] = next;
      };
      if (x > 0) visit(pixel - 1);
      if (x + 1 < width) visit(pixel + 1);
      if (y > 0) visit(pixel - width);
      if (y + 1 < height) visit(pixel + width);
    }

    const blend = strength / 100;
    const searchRadius = Math.min(10, edgeWidth + 4);
    const original = new Uint8ClampedArray(pixels);

    for (let pixel = 0; pixel < total; pixel += 1) {
      if (alpha[pixel] <= 16 || distance[pixel] < 1 || distance[pixel] > edgeWidth) continue;
      const offset = pixel * 4;
      const luminance = original[offset] * 0.2126 + original[offset + 1] * 0.7152 + original[offset + 2] * 0.0722;
      if (luminance > 92) continue;

      const x = pixel % width;
      const y = Math.floor(pixel / width);
      let bestOffset = -1;
      let bestDistance = Infinity;
      for (let dy = -searchRadius; dy <= searchRadius; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -searchRadius; dx <= searchRadius; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width || (!dx && !dy)) continue;
          const candidate = yy * width + xx;
          if (alpha[candidate] < 80) continue;
          const candidateOffset = candidate * 4;
          const candidateLuminance = original[candidateOffset] * 0.2126 + original[candidateOffset + 1] * 0.7152 + original[candidateOffset + 2] * 0.0722;
          if (candidateLuminance < Math.max(76, luminance + 18)) continue;
          const squared = dx * dx + dy * dy;
          if (squared >= bestDistance) continue;
          bestDistance = squared;
          bestOffset = candidateOffset;
        }
      }

      if (bestOffset >= 0) {
        pixels[offset] = Math.round(original[offset] * (1 - blend) + original[bestOffset] * blend);
        pixels[offset + 1] = Math.round(original[offset + 1] * (1 - blend) + original[bestOffset + 1] * blend);
        pixels[offset + 2] = Math.round(original[offset + 2] * (1 - blend) + original[bestOffset + 2] * blend);
      }
    }
  }

  function apply(canvas, config, dimension) {
    if (!canvas || !config) return canvas;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const image = context.getImageData(0, 0, dimension, dimension);
    const pixels = image.data;
    const total = dimension * dimension;
    const target = hexToRgb(config.color || '#00ff00');
    const tolerance = Math.max(0, Number(config.tolerance) || 0);
    const softness = Math.max(0, Number(config.softness) || 0);
    const maximumDistance = tolerance + softness;
    const match = new Uint8Array(total);
    const strength = new Uint8Array(total);

    for (let pixel = 0; pixel < total; pixel += 1) {
      const offset = pixel * 4;
      if (!pixels[offset + 3]) continue;
      const distance = Math.hypot(
        pixels[offset] - target.r,
        pixels[offset + 1] - target.g,
        pixels[offset + 2] - target.b
      );
      if (distance > maximumDistance) continue;
      match[pixel] = 1;
      strength[pixel] = softness > 0 && distance > tolerance
        ? Math.round(255 * (1 - (distance - tolerance) / softness))
        : 255;
    }

    let selected = match;
    if (config.outsideOnly && config.protectHoles !== false) {
      selected = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;
      const seed = (pixel) => {
        if (!match[pixel] || selected[pixel]) return;
        selected[pixel] = 1;
        queue[tail++] = pixel;
      };
      for (let x = 0; x < dimension; x += 1) {
        seed(x);
        seed((dimension - 1) * dimension + x);
      }
      for (let y = 1; y < dimension - 1; y += 1) {
        seed(y * dimension);
        seed(y * dimension + dimension - 1);
      }
      while (head < tail) {
        const pixel = queue[head++];
        const x = pixel % dimension;
        const y = Math.floor(pixel / dimension);
        if (x > 0) seed(pixel - 1);
        if (x + 1 < dimension) seed(pixel + 1);
        if (y > 0) seed(pixel - dimension);
        if (y + 1 < dimension) seed(pixel + dimension);
      }
    }

    let alpha = new Uint8ClampedArray(total);
    for (let pixel = 0; pixel < total; pixel += 1) {
      const originalAlpha = pixels[pixel * 4 + 3];
      alpha[pixel] = selected[pixel]
        ? Math.round(originalAlpha * (1 - strength[pixel] / 255))
        : originalAlpha;
    }

    const alphaAdjust = Math.max(-4, Math.min(4, Math.round(Number(config.alphaAdjust) || 0)));
    if (alphaAdjust) {
      alpha = morphAlpha(alpha, dimension, dimension, Math.abs(alphaAdjust), alphaAdjust > 0);
    }
    const feather = Math.max(0, Math.min(6, Math.round(Number(config.feather) || 0)));
    if (feather) alpha = blurAlpha(alpha, dimension, dimension, feather);
    removeSmallIslands(alpha, dimension, dimension, Math.max(0, Math.round(Number(config.despeckle) || 0)));

    if (config.removeBlackMatte) {
      removeBlackMatte(
        pixels,
        alpha,
        dimension,
        dimension,
        Math.max(0, Math.round(Number(config.matteWidth) || 0)),
        Math.max(0, Math.min(100, Number(config.matteStrength) || 0))
      );
    }

    for (let pixel = 0; pixel < total; pixel += 1) {
      const offset = pixel * 4;
      pixels[offset + 3] = alpha[pixel];
      if (!alpha[pixel]) {
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }

  function applySafeShadow(source, options) {
    if (!source || !options?.enabled) return source;
    const dimension = source.width;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    const sourcePixels = sourceContext.getImageData(0, 0, dimension, dimension).data;
    let visible = false;
    let transparent = false;

    for (let offset = 3; offset < sourcePixels.length; offset += 4) {
      if (sourcePixels[offset]) visible = true;
      if (sourcePixels[offset] < 250) transparent = true;
      if (visible && transparent) break;
    }
    if (!visible || !transparent) return source;

    const blur = Math.max(0, Number(options.blur) || 0);
    const offsetX = Number(options.offsetX) || 0;
    const offsetY = Number(options.offsetY) || 0;
    const padding = Math.ceil(blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY)) + 6);
    const padded = makeCanvas(dimension + padding * 2);
    const paddedContext = padded.getContext('2d');
    paddedContext.save();
    paddedContext.globalAlpha = Math.max(0, Math.min(1, Number(options.opacity) || 0));
    paddedContext.shadowColor = rgba(options.color || '#000000', 1);
    paddedContext.shadowBlur = blur;
    paddedContext.shadowOffsetX = offsetX;
    paddedContext.shadowOffsetY = offsetY;
    paddedContext.drawImage(source, padding, padding);
    paddedContext.restore();
    paddedContext.drawImage(source, padding, padding);

    const result = makeCanvas(dimension);
    const resultContext = result.getContext('2d', { willReadFrequently: true });
    resultContext.drawImage(padded, padding, padding, dimension, dimension, 0, 0, dimension, dimension);

    const resultImage = resultContext.getImageData(0, 0, dimension, dimension);
    const resultPixels = resultImage.data;
    const guard = 2;
    for (let y = 0; y < dimension; y += 1) {
      for (let x = 0; x < dimension; x += 1) {
        if (x >= guard && x < dimension - guard && y >= guard && y < dimension - guard) continue;
        const offset = (y * dimension + x) * 4;
        if (sourcePixels[offset + 3]) continue;
        resultPixels[offset] = 0;
        resultPixels[offset + 1] = 0;
        resultPixels[offset + 2] = 0;
        resultPixels[offset + 3] = 0;
      }
    }
    resultContext.putImageData(resultImage, 0, 0);
    return result;
  }

  window.__organonAdvancedBackgroundCore = { apply, applySafeShadow };
})();

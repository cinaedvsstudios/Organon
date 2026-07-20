(() => {
  'use strict';

  const STORAGE_KEY = 'organon-image-calculator-palette-picker-v1';
  const ROLE_NAMES = ['Background', 'Surface', 'Text', 'Primary', 'Secondary', 'Accent'];
  const PRESETS = [
    ['balanced', 'Balanced'],
    ['game-ui', 'Game UI'],
    ['website-ui', 'Website UI'],
    ['dark-theme', 'Dark Theme'],
    ['high-contrast', 'High Contrast'],
    ['accessibility', 'Accessibility First'],
    ['soft-pastel', 'Soft / Pastel'],
    ['vibrant', 'Vibrant'],
    ['cinematic', 'Cinematic']
  ];

  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const round = (value, places = 0) => Number(value.toFixed(places));
  const hex2 = (value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0').toUpperCase();

  function rgbToHex(rgb, alpha = 1, includeAlpha = false) {
    const base = `#${hex2(rgb.r)}${hex2(rgb.g)}${hex2(rgb.b)}`;
    return includeAlpha || alpha < 0.999 ? `${base}${hex2(alpha * 255)}` : base;
  }

  function parseHex(value) {
    const text = String(value || '').trim().replace(/^#/, '');
    if (![3, 4, 6, 8].includes(text.length) || !/^[0-9a-f]+$/i.test(text)) return null;
    const expanded = text.length <= 4 ? [...text].map((char) => char + char).join('') : text;
    return {
      rgb: {
        r: parseInt(expanded.slice(0, 2), 16),
        g: parseInt(expanded.slice(2, 4), 16),
        b: parseInt(expanded.slice(4, 6), 16)
      },
      alpha: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1
    };
  }

  function rgbToHsv(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    let h = 0;
    if (delta) {
      if (maximum === r) h = 60 * mod((g - b) / delta, 6);
      else if (maximum === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    return { h, s: maximum ? delta / maximum : 0, v: maximum };
  }

  function hsvToRgb(hsv) {
    const h = mod(Number(hsv.h) || 0, 360);
    const s = clamp(Number(hsv.s) || 0);
    const v = clamp(Number(hsv.v) || 0);
    const c = v * s;
    const x = c * (1 - Math.abs(mod(h / 60, 2) - 1));
    const m = v - c;
    let values;
    if (h < 60) values = [c, x, 0];
    else if (h < 120) values = [x, c, 0];
    else if (h < 180) values = [0, c, x];
    else if (h < 240) values = [0, x, c];
    else if (h < 300) values = [x, 0, c];
    else values = [c, 0, x];
    return { r: (values[0] + m) * 255, g: (values[1] + m) * 255, b: (values[2] + m) * 255 };
  }

  function rgbToHsl(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    const l = (maximum + minimum) / 2;
    let h = 0;
    let s = 0;
    if (delta) {
      s = delta / (1 - Math.abs(2 * l - 1));
      if (maximum === r) h = 60 * mod((g - b) / delta, 6);
      else if (maximum === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
    }
    return { h, s, l };
  }

  function hslToRgb(hsl) {
    const h = mod(Number(hsl.h) || 0, 360);
    const s = clamp(Number(hsl.s) || 0);
    const l = clamp(Number(hsl.l) || 0);
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(mod(h / 60, 2) - 1));
    const m = l - c / 2;
    let values;
    if (h < 60) values = [c, x, 0];
    else if (h < 120) values = [x, c, 0];
    else if (h < 180) values = [0, c, x];
    else if (h < 240) values = [0, x, c];
    else if (h < 300) values = [x, 0, c];
    else values = [c, 0, x];
    return { r: (values[0] + m) * 255, g: (values[1] + m) * 255, b: (values[2] + m) * 255 };
  }

  function srgbToLinear(value) {
    const channel = clamp(value / 255);
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }

  function linearToSrgb(value) {
    const channel = value <= 0.0031308 ? value * 12.92 : 1.055 * (Math.max(0, value) ** (1 / 2.4)) - 0.055;
    return clamp(channel) * 255;
  }

  function rgbToOklab(rgb) {
    const r = srgbToLinear(rgb.r);
    const g = srgbToLinear(rgb.g);
    const b = srgbToLinear(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
      L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
  }

  function oklabToRgb(lab) {
    const l = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
    const m = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
    const s = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
    const l3 = l ** 3;
    const m3 = m ** 3;
    const s3 = s ** 3;
    return {
      r: linearToSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
      g: linearToSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
      b: linearToSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3)
    };
  }

  function rgbToOklch(rgb) {
    const lab = rgbToOklab(rgb);
    return { L: lab.L, C: Math.hypot(lab.a, lab.b), h: mod(Math.atan2(lab.b, lab.a) * 180 / Math.PI, 360) };
  }

  function oklchToRgb(lch) {
    const radians = mod(lch.h, 360) * Math.PI / 180;
    return oklabToRgb({ L: clamp(lch.L), a: Math.max(0, lch.C) * Math.cos(radians), b: Math.max(0, lch.C) * Math.sin(radians) });
  }

  function relativeLuminance(rgb) {
    const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
      const channel = clamp(value / 255);
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrastRatio(first, second) {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function hueDistance(first, second) {
    const distance = Math.abs(mod(first - second, 360));
    return Math.min(distance, 360 - distance);
  }

  function perceptualDistance(first, second) {
    const a = rgbToOklab(first);
    const b = rgbToOklab(second);
    return Math.hypot((a.L - b.L) * 1.45, a.a - b.a, a.b - b.b);
  }

  function cssRgb(rgb) {
    return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
  }

  function copyText(doc, text, feedback) {
    const view = doc.defaultView;
    const finish = () => {
      if (!feedback) return;
      const original = feedback.textContent;
      feedback.textContent = 'Copied';
      setTimeout(() => { feedback.textContent = original; }, 900);
    };
    if (view.navigator.clipboard?.writeText) {
      view.navigator.clipboard.writeText(text).then(finish).catch(() => fallbackCopy());
    } else fallbackCopy();

    function fallbackCopy() {
      const input = doc.createElement('textarea');
      input.value = text;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      doc.body.appendChild(input);
      input.select();
      try { doc.execCommand('copy'); } catch (error) {}
      input.remove();
      finish();
    }
  }

  function makeRgbFromHsl(h, s, l) {
    return hslToRgb({ h, s: s / 100, l: l / 100 });
  }

  function ensureContrast(color, background, minimum) {
    if (contrastRatio(color, background) >= minimum) return color;
    const hsl = rgbToHsl(color);
    const backgroundLuminance = relativeLuminance(background);
    let best = color;
    let bestRatio = contrastRatio(color, background);
    for (let step = 0; step <= 100; step += 2) {
      const lightness = backgroundLuminance > 0.45 ? step / 100 : 1 - step / 100;
      const candidate = hslToRgb({ h: hsl.h, s: hsl.s, l: lightness });
      const ratio = contrastRatio(candidate, background);
      if (ratio > bestRatio) {
        best = candidate;
        bestRatio = ratio;
      }
      if (ratio >= minimum) return candidate;
    }
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    return contrastRatio(black, background) > contrastRatio(white, background) ? black : white;
  }

  function extractPalette(doc, canvas, count = 6) {
    const sample = doc.createElement('canvas');
    const maximum = 112;
    const ratio = Math.min(maximum / canvas.width, maximum / canvas.height, 1);
    sample.width = Math.max(24, Math.round(canvas.width * ratio));
    sample.height = Math.max(24, Math.round(canvas.height * ratio));
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    const buckets = new Map();

    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] < 96) continue;
      const r = Math.round(data[index] / 20) * 20;
      const g = Math.round(data[index + 1] / 20) * 20;
      const b = Math.round(data[index + 2] / 20) * 20;
      const key = `${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)}`;
      const entry = buckets.get(key) || { r: Math.min(255, r), g: Math.min(255, g), b: Math.min(255, b), count: 0 };
      entry.count += 1;
      buckets.set(key, entry);
    }

    const candidates = [...buckets.values()].sort((a, b) => {
      const sa = rgbToHsl(a).s;
      const sb = rgbToHsl(b).s;
      return b.count * (0.75 + sb * 0.25) - a.count * (0.75 + sa * 0.25);
    });

    const selected = [];
    for (const candidate of candidates) {
      if (!selected.length || selected.every((color) => perceptualDistance(candidate, color) > 0.075)) selected.push(candidate);
      if (selected.length >= count) break;
    }
    const fallback = [
      { r: 24, g: 25, b: 25 }, { r: 41, g: 42, b: 36 }, { r: 245, g: 240, b: 219 },
      { r: 75, g: 132, b: 191 }, { r: 224, g: 163, b: 96 }, { r: 154, g: 47, b: 79 }
    ];
    while (selected.length < count) selected.push(fallback[selected.length]);
    return selected.slice(0, count).map(({ r, g, b }) => ({ r, g, b }));
  }

  function assignOriginalRoles(palette) {
    const colors = palette.map((color, index) => ({
      ...color,
      index,
      luminance: relativeLuminance(color),
      saturation: rgbToHsl(color).s,
      hue: rgbToHsl(color).h
    }));
    const background = colors[0] || colors.slice().sort((a, b) => a.luminance - b.luminance)[0];
    const surface = colors
      .filter((color) => color.index !== background.index)
      .sort((a, b) => Math.abs(a.luminance - background.luminance) - Math.abs(b.luminance - background.luminance))[0] || background;
    const text = colors.slice().sort((a, b) => contrastRatio(b, background) - contrastRatio(a, background))[0] || colors[0];
    const candidates = colors.filter((color) => ![background.index, surface.index, text.index].includes(color.index));
    const primary = candidates.slice().sort((a, b) => b.saturation - a.saturation)[0] || colors[3] || colors[0];
    const secondary = candidates
      .filter((color) => color.index !== primary.index)
      .sort((a, b) => (hueDistance(b.hue, primary.hue) * 0.01 + b.saturation) - (hueDistance(a.hue, primary.hue) * 0.01 + a.saturation))[0] || colors[4] || primary;
    const accent = colors.find((color) => ![background.index, surface.index, text.index, primary.index, secondary.index].includes(color.index)) || colors[5] || secondary;
    return [background, surface, text, primary, secondary, accent].map(({ r, g, b }) => ({ r, g, b }));
  }

  function generateSuggestedPalette(originalPalette, preset) {
    const roleOriginal = assignOriginalRoles(originalPalette);
    const chromatic = originalPalette
      .map((color) => ({ color, hsl: rgbToHsl(color) }))
      .sort((a, b) => b.hsl.s - a.hsl.s);
    const primarySource = chromatic[0] || { hsl: { h: 210, s: 0.5, l: 0.5 } };
    const secondarySource = chromatic.find((entry) => hueDistance(entry.hsl.h, primarySource.hsl.h) > 35) || chromatic[1] || primarySource;
    const h = primarySource.hsl.h;
    const secondaryHue = secondarySource.hsl.h;
    const complement = mod(h + 180, 360);
    const average = originalPalette.reduce((sum, color) => sum + relativeLuminance(color), 0) / originalPalette.length;
    const darkSource = average < 0.46;
    let values;

    switch (preset) {
      case 'game-ui':
        values = [
          makeRgbFromHsl(h, 24, 7), makeRgbFromHsl(h + 8, 22, 15), makeRgbFromHsl(45, 22, 94),
          makeRgbFromHsl(h, 82, 56), makeRgbFromHsl(secondaryHue, 72, 51), makeRgbFromHsl(complement, 90, 61)
        ];
        break;
      case 'website-ui':
        values = [
          makeRgbFromHsl(h, 15, 98), makeRgbFromHsl(h + 8, 13, 92), makeRgbFromHsl(h, 28, 13),
          makeRgbFromHsl(h, 72, 44), makeRgbFromHsl(secondaryHue, 55, 43), makeRgbFromHsl(complement, 68, 47)
        ];
        break;
      case 'dark-theme':
        values = [
          makeRgbFromHsl(h, 16, 7), makeRgbFromHsl(h + 10, 18, 14), makeRgbFromHsl(h, 10, 93),
          makeRgbFromHsl(h, 64, 57), makeRgbFromHsl(secondaryHue, 50, 51), makeRgbFromHsl(complement, 64, 59)
        ];
        break;
      case 'high-contrast':
        values = [
          { r: 0, g: 0, b: 0 }, { r: 20, g: 20, b: 20 }, { r: 255, g: 255, b: 255 },
          makeRgbFromHsl(h, 100, 56), makeRgbFromHsl(complement, 100, 52), makeRgbFromHsl(55, 100, 56)
        ];
        break;
      case 'accessibility':
        values = darkSource ? [
          makeRgbFromHsl(h, 16, 6), makeRgbFromHsl(h, 16, 15), { r: 255, g: 255, b: 255 },
          makeRgbFromHsl(h, 82, 64), makeRgbFromHsl(secondaryHue, 72, 66), makeRgbFromHsl(complement, 86, 68)
        ] : [
          makeRgbFromHsl(h, 12, 98), makeRgbFromHsl(h, 12, 90), { r: 8, g: 12, b: 16 },
          makeRgbFromHsl(h, 88, 36), makeRgbFromHsl(secondaryHue, 76, 34), makeRgbFromHsl(complement, 82, 34)
        ];
        break;
      case 'soft-pastel':
        values = [
          makeRgbFromHsl(h, 34, 97), makeRgbFromHsl(h + 15, 30, 90), makeRgbFromHsl(h, 28, 20),
          makeRgbFromHsl(h, 48, 65), makeRgbFromHsl(secondaryHue, 42, 68), makeRgbFromHsl(complement, 46, 69)
        ];
        break;
      case 'vibrant':
        values = [
          makeRgbFromHsl(h, 24, 7), makeRgbFromHsl(h + 10, 24, 14), { r: 248, g: 248, b: 248 },
          makeRgbFromHsl(h, 96, 58), makeRgbFromHsl(secondaryHue, 88, 55), makeRgbFromHsl(complement, 100, 60)
        ];
        break;
      case 'cinematic':
        values = [
          makeRgbFromHsl(h + 185, 26, 6), makeRgbFromHsl(h + 180, 24, 14), makeRgbFromHsl(42, 28, 91),
          makeRgbFromHsl(h + 170, 62, 45), makeRgbFromHsl(h + 25, 72, 52), makeRgbFromHsl(42, 78, 58)
        ];
        break;
      default:
        values = darkSource ? [
          makeRgbFromHsl(h, 14, 9), makeRgbFromHsl(h + 8, 15, 17), makeRgbFromHsl(45, 20, 94),
          makeRgbFromHsl(h, 68, 56), makeRgbFromHsl(secondaryHue, 56, 49), makeRgbFromHsl(complement, 72, 59)
        ] : [
          makeRgbFromHsl(h, 20, 97), makeRgbFromHsl(h + 8, 16, 90), makeRgbFromHsl(h, 20, 14),
          makeRgbFromHsl(h, 70, 43), makeRgbFromHsl(secondaryHue, 56, 45), makeRgbFromHsl(complement, 70, 46)
        ];
    }

    const minimumText = preset === 'accessibility' ? 7 : 4.5;
    values[2] = ensureContrast(values[2], values[0], minimumText);
    values[3] = ensureContrast(values[3], values[0], preset === 'accessibility' ? 4.5 : 3);
    values[4] = ensureContrast(values[4], values[0], 3);
    values[5] = ensureContrast(values[5], values[0], 3);
    return { roleOriginal, suggested: values.map((color) => ({ r: clamp(color.r, 0, 255), g: clamp(color.g, 0, 255), b: clamp(color.b, 0, 255) })) };
  }

  function buildCss(roles) {
    const lines = ['/* Organon Auto Palette */', ':root {'];
    roles.forEach((entry) => lines.push(`  --color-${entry.role.toLowerCase().replace(/\s+/g, '-')}: ${rgbToHex(entry.suggested)};`));
    lines.push('}');
    return lines.join('\n');
  }

  function installStyles(doc) {
    if (doc.getElementById('organon-palette-picker-styles')) return;
    const style = doc.createElement('style');
    style.id = 'organon-palette-picker-styles';
    style.textContent = `
      #panel-chroma .opp-section{margin-top:12px;padding:11px;border:1px solid rgba(137,107,73,.62);border-radius:13px;background:rgba(0,0,0,.19)}
      #panel-chroma .opp-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;color:var(--stone-ochre);font:700 .66rem var(--font-headers);letter-spacing:.05em;text-transform:uppercase}
      #panel-chroma .opp-swatch-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
      #panel-chroma .opp-swatch{position:relative;min-height:54px;padding:5px;border:1px solid rgba(255,255,255,.24);border-radius:8px;cursor:pointer;overflow:hidden;box-shadow:inset 0 -22px 18px rgba(0,0,0,.22)}
      #panel-chroma .opp-swatch.active{outline:2px solid var(--water-spray);outline-offset:2px}
      #panel-chroma .opp-swatch span{position:absolute;left:3px;right:3px;bottom:3px;padding:2px;border-radius:4px;background:rgba(0,0,0,.68);color:#fff;font:600 .48rem var(--font-mono);text-align:center}
      #panel-chroma .opp-picker-grid{display:grid;grid-template-columns:minmax(180px,1.15fr) minmax(190px,.85fr);gap:10px}
      #panel-chroma .opp-color-field{display:block;width:100%;height:165px;border:1px solid var(--chiseled-bronze);border-radius:10px;cursor:crosshair;touch-action:none}
      #panel-chroma .opp-slider-line{display:grid;grid-template-columns:45px minmax(0,1fr) 48px;align-items:center;gap:7px;margin-top:8px;color:rgba(245,240,219,.72);font:.56rem var(--font-mono);text-transform:uppercase}
      #panel-chroma .opp-slider-line output{text-align:right;color:var(--water-spray)}
      #panel-chroma .opp-current{height:58px;margin-bottom:8px;border:1px solid var(--chiseled-bronze);border-radius:10px;box-shadow:inset 0 0 24px rgba(0,0,0,.25)}
      #panel-chroma .opp-value-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:5px;align-items:center;margin-top:6px}
      #panel-chroma .opp-value-row label{color:var(--stone-ochre);font:.55rem var(--font-mono)}
      #panel-chroma .opp-value-row input{min-width:0;padding:6px 8px!important;border-radius:7px!important;font:.62rem var(--font-mono)!important}
      #panel-chroma .opp-copy{min-width:48px;padding:6px!important;border-radius:7px!important}
      #panel-chroma .opp-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;align-items:end}
      #panel-chroma .opp-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
      #panel-chroma .opp-actions.secondary{grid-template-columns:repeat(3,1fr)}
      #panel-chroma .opp-primary{background:var(--brand-red)!important;color:#fff!important}
      #panel-chroma .opp-comparison{display:grid;gap:5px;margin-top:10px}
      #panel-chroma .opp-role-row{display:grid;grid-template-columns:70px 48px 18px 48px minmax(70px,1fr);align-items:center;gap:6px;padding:6px;border:1px solid rgba(137,107,73,.35);border-radius:8px;background:rgba(0,0,0,.22)}
      #panel-chroma .opp-role-name{color:var(--stone-ochre);font:600 .56rem var(--font-mono);text-transform:uppercase}
      #panel-chroma .opp-role-color{height:30px;border:1px solid rgba(255,255,255,.25);border-radius:6px}
      #panel-chroma .opp-role-arrow{text-align:center;color:var(--water-spray)}
      #panel-chroma .opp-role-score{color:rgba(245,240,219,.7);font:.53rem var(--font-mono);text-align:right}
      #panel-chroma .opp-preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      #panel-chroma .opp-preview-card{position:relative;min-height:90px;padding:5px;border:1px solid rgba(137,107,73,.55);border-radius:10px;background:#090a09}
      #panel-chroma .opp-preview-card canvas{display:block;width:100%;height:112px;object-fit:contain;cursor:default}
      #panel-chroma .opp-preview-card span{position:absolute;left:8px;top:7px;padding:2px 6px;border-radius:999px;background:rgba(0,0,0,.72);color:#fff;font:.5rem var(--font-mono)}
      #panel-chroma .opp-css{max-height:145px;margin:0;overflow:auto;white-space:pre;color:var(--water-spray);font:.61rem/1.45 var(--font-mono)}
      #panel-chroma .opp-note{margin:7px 0 0;color:rgba(245,240,219,.58);font:.58rem/1.45 var(--font-body)}
      #panel-chroma .opp-pick-active{background:var(--water-blue)!important;color:#fff!important;border-color:var(--water-spray)!important}
      @media(max-width:620px){
        #panel-chroma .opp-picker-grid{grid-template-columns:1fr}
        #panel-chroma .opp-swatch-grid{grid-template-columns:repeat(3,1fr)}
        #panel-chroma .opp-role-row{grid-template-columns:64px 42px 14px 42px 1fr}
      }
    `;
    doc.head.appendChild(style);
  }

  function buildPanel(doc, panel) {
    const presetOptions = PRESETS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    panel.innerHTML = `
      <h3>🎨 Palette & Picker</h3>
      <p>Extract colours from the uploaded image, pick exact values, generate an improved design palette, or recolour the screenshot with it.</p>

      <section class="opp-section">
        <div class="opp-section-title"><span>Image palette</span><button type="button" class="micro-action-btn" id="opp-refresh">Refresh colours</button></div>
        <div class="opp-swatch-grid" id="opp-extracted"></div>
        <p class="opp-note">Click a swatch to load it into the picker. Use “Pick from image” to sample any visible pixel.</p>
      </section>

      <section class="opp-section">
        <div class="opp-section-title"><span>Colour picker</span><button type="button" class="micro-action-btn" id="opp-pick-image">Pick from image</button></div>
        <div class="opp-picker-grid">
          <div>
            <canvas class="opp-color-field" id="opp-color-field" width="420" height="260"></canvas>
            <div class="opp-slider-line"><span>Hue</span><input id="opp-hue" type="range" min="0" max="360" step="1" value="35"><output id="opp-hue-out">35°</output></div>
            <div class="opp-slider-line"><span>Alpha</span><input id="opp-alpha" type="range" min="0" max="100" step="1" value="100"><output id="opp-alpha-out">100%</output></div>
          </div>
          <div>
            <div class="opp-current" id="opp-current"></div>
            <div class="opp-value-row"><label for="opp-hex">HEX</label><input id="opp-hex" type="text" value="#E0A360"><button type="button" class="micro-action-btn opp-copy" data-copy="opp-hex">Copy</button></div>
            <div class="opp-value-row"><label for="opp-rgb">RGB</label><input id="opp-rgb" type="text"><button type="button" class="micro-action-btn opp-copy" data-copy="opp-rgb">Copy</button></div>
            <div class="opp-value-row"><label for="opp-hsl">HSL</label><input id="opp-hsl" type="text"><button type="button" class="micro-action-btn opp-copy" data-copy="opp-hsl">Copy</button></div>
            <div class="opp-value-row"><label for="opp-hsv">HSV</label><input id="opp-hsv" type="text"><button type="button" class="micro-action-btn opp-copy" data-copy="opp-hsv">Copy</button></div>
            <div class="opp-value-row"><label for="opp-oklch">OKLCH</label><input id="opp-oklch" type="text"><button type="button" class="micro-action-btn opp-copy" data-copy="opp-oklch">Copy</button></div>
          </div>
        </div>
      </section>

      <section class="opp-section">
        <div class="opp-section-title"><span>Auto Palette</span><span id="opp-palette-status">Ready</span></div>
        <div class="opp-toolbar">
          <label class="field-group"><span class="field-label">Palette style</span><select id="opp-preset">${presetOptions}</select></label>
          <button type="button" class="micro-action-btn" id="opp-use-picker">Use picker as primary</button>
        </div>
        <div class="opp-actions">
          <button type="button" class="micro-action-btn" id="opp-generate">Auto palette only</button>
          <button type="button" class="micro-action-btn opp-primary" id="opp-recolour">Recolour image</button>
        </div>
        <div class="opp-comparison" id="opp-comparison"></div>
        <div class="opp-actions secondary">
          <button type="button" class="micro-action-btn" id="opp-undo">Undo</button>
          <button type="button" class="micro-action-btn" id="opp-reset">Reset</button>
          <button type="button" class="micro-action-btn" id="opp-download" disabled>Download recoloured PNG</button>
        </div>
        <div class="opp-preview-grid">
          <div class="opp-preview-card"><span>Before</span><canvas id="opp-before" width="320" height="180"></canvas></div>
          <div class="opp-preview-card"><span>After</span><canvas id="opp-after" width="320" height="180"></canvas></div>
        </div>
      </section>

      <section class="opp-section">
        <div class="opp-section-title"><span>Generated CSS variables</span><button type="button" class="micro-action-btn" id="opp-copy-css">Copy CSS</button></div>
        <pre class="opp-css" id="opp-css">/* Generate an auto palette to create CSS variables. */</pre>
      </section>
    `;
  }

  function install(doc, options = {}) {
    if (!doc || doc.__organonPalettePickerInstalled) return;
    const panel = doc.getElementById('panel-chroma');
    const canvas = doc.getElementById('main-canvas');
    if (!panel || !canvas) return;
    doc.__organonPalettePickerInstalled = true;
    installStyles(doc);
    buildPanel(doc, panel);

    const title = doc.querySelector('.selector-card[data-target="chroma"] .sel-title');
    const selector = doc.querySelector('.selector-card[data-target="chroma"]');
    if (title) title.textContent = 'Palette & Picker';
    if (selector) selector.title = 'Extract, pick, improve and apply a complete colour palette';

    const context = canvas.getContext('2d', { willReadFrequently: true });
    const view = doc.defaultView;
    const ui = {};
    [
      'opp-refresh', 'opp-extracted', 'opp-pick-image', 'opp-color-field', 'opp-hue', 'opp-hue-out',
      'opp-alpha', 'opp-alpha-out', 'opp-current', 'opp-hex', 'opp-rgb', 'opp-hsl', 'opp-hsv',
      'opp-oklch', 'opp-preset', 'opp-use-picker', 'opp-generate', 'opp-recolour', 'opp-comparison',
      'opp-undo', 'opp-reset', 'opp-download', 'opp-before', 'opp-after', 'opp-css', 'opp-copy-css',
      'opp-palette-status'
    ].forEach((id) => { ui[id] = doc.getElementById(id); });

    const state = {
      hsv: { h: 35, s: 0.57, v: 0.88 },
      alpha: 1,
      originalPalette: [],
      roleOriginal: [],
      suggested: [],
      roles: [],
      baseline: null,
      recoloured: null,
      undo: [],
      pickFromImage: false,
      applying: false,
      refreshTimer: 0,
      lastCanvasSignature: '',
      options
    };

    function setStatus(text) {
      ui['opp-palette-status'].textContent = text;
      try { view.parent.postMessage({ type: 'set-status', text }, '*'); } catch (error) {}
      setTimeout(() => {
        if (ui['opp-palette-status'].textContent === text) ui['opp-palette-status'].textContent = 'Ready';
        try { view.parent.postMessage({ type: 'clear-status' }, '*'); } catch (error) {}
      }, 2600);
    }

    function saveState() {
      const payload = {
        hsv: state.hsv,
        alpha: state.alpha,
        preset: ui['opp-preset'].value,
        originalPalette: state.originalPalette.map((color) => rgbToHex(color)),
        roleOriginal: state.roleOriginal.map((color) => rgbToHex(color)),
        suggested: state.suggested.map((color) => rgbToHex(color)),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };
      if (state.recoloured) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          if (dataUrl.length < 3000000) payload.recolouredDataUrl = dataUrl;
        } catch (error) {}
      }
      try { view.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch (error) {}
    }

    function readSavedState() {
      try { return JSON.parse(view.sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch (error) { return null; }
    }

    function cloneImageData(imageData) {
      if (!imageData) return null;
      return new view.ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
    }

    function snapshotUndo() {
      let imageData = null;
      try { imageData = cloneImageData(context.getImageData(0, 0, canvas.width, canvas.height)); } catch (error) {}
      state.undo.push({
        imageData,
        originalPalette: state.originalPalette.map((color) => ({ ...color })),
        roleOriginal: state.roleOriginal.map((color) => ({ ...color })),
        suggested: state.suggested.map((color) => ({ ...color })),
        recoloured: Boolean(state.recoloured)
      });
      if (state.undo.length > 8) state.undo.shift();
    }

    function canvasSignature() {
      return `${canvas.width}x${canvas.height}:${canvas.toDataURL('image/png').slice(-80)}`;
    }

    function captureBaseline(force = false) {
      if (state.applying) return;
      let signature = '';
      try { signature = canvasSignature(); } catch (error) {}
      if (!force && signature && signature === state.lastCanvasSignature) return;
      state.lastCanvasSignature = signature;
      try {
        state.baseline = cloneImageData(context.getImageData(0, 0, canvas.width, canvas.height));
      } catch (error) {
        state.baseline = null;
      }
      state.recoloured = null;
      ui['opp-download'].disabled = true;
      state.originalPalette = extractPalette(doc, canvas, 6);
      const generated = generateSuggestedPalette(state.originalPalette, ui['opp-preset'].value || 'balanced');
      state.roleOriginal = generated.roleOriginal;
      state.suggested = generated.suggested;
      updateRoles();
      renderExtracted();
      renderComparison();
      renderPreviews();
      saveState();
    }

    function currentRgb() {
      return hsvToRgb(state.hsv);
    }

    function setCurrentRgb(rgb, alpha = state.alpha, updateHue = true) {
      const hsv = rgbToHsv(rgb);
      if (!updateHue && hsv.s < 0.001) hsv.h = state.hsv.h;
      state.hsv = hsv;
      state.alpha = clamp(alpha);
      ui['opp-hue'].value = String(round(state.hsv.h));
      ui['opp-alpha'].value = String(round(state.alpha * 100));
      renderPicker();
      updateValueInputs();
      saveState();
    }

    function updateValueInputs() {
      const rgb = currentRgb();
      const hsl = rgbToHsl(rgb);
      const oklch = rgbToOklch(rgb);
      ui['opp-current'].style.background = rgbToHex(rgb);
      ui['opp-current'].style.opacity = String(state.alpha);
      ui['opp-hue-out'].textContent = `${round(state.hsv.h)}°`;
      ui['opp-alpha-out'].textContent = `${round(state.alpha * 100)}%`;
      ui['opp-hex'].value = rgbToHex(rgb, state.alpha, state.alpha < 0.999);
      ui['opp-rgb'].value = `rgb(${round(rgb.r)}, ${round(rgb.g)}, ${round(rgb.b)} / ${round(state.alpha, 2)})`;
      ui['opp-hsl'].value = `hsl(${round(hsl.h)} ${round(hsl.s * 100)}% ${round(hsl.l * 100)}% / ${round(state.alpha, 2)})`;
      ui['opp-hsv'].value = `hsv(${round(state.hsv.h)} ${round(state.hsv.s * 100)}% ${round(state.hsv.v * 100)}% / ${round(state.alpha, 2)})`;
      ui['opp-oklch'].value = `oklch(${round(oklch.L, 3)} ${round(oklch.C, 3)} ${round(oklch.h)} / ${round(state.alpha, 2)})`;
    }

    function renderPicker() {
      const field = ui['opp-color-field'];
      const fieldContext = field.getContext('2d');
      const width = field.width;
      const height = field.height;
      fieldContext.clearRect(0, 0, width, height);
      fieldContext.fillStyle = cssRgb(hsvToRgb({ h: state.hsv.h, s: 1, v: 1 }));
      fieldContext.fillRect(0, 0, width, height);
      const white = fieldContext.createLinearGradient(0, 0, width, 0);
      white.addColorStop(0, '#fff');
      white.addColorStop(1, 'rgba(255,255,255,0)');
      fieldContext.fillStyle = white;
      fieldContext.fillRect(0, 0, width, height);
      const black = fieldContext.createLinearGradient(0, 0, 0, height);
      black.addColorStop(0, 'rgba(0,0,0,0)');
      black.addColorStop(1, '#000');
      fieldContext.fillStyle = black;
      fieldContext.fillRect(0, 0, width, height);
      const x = state.hsv.s * width;
      const y = (1 - state.hsv.v) * height;
      fieldContext.beginPath();
      fieldContext.arc(x, y, 8, 0, Math.PI * 2);
      fieldContext.strokeStyle = state.hsv.v > 0.55 ? '#000' : '#fff';
      fieldContext.lineWidth = 5;
      fieldContext.stroke();
      fieldContext.beginPath();
      fieldContext.arc(x, y, 7, 0, Math.PI * 2);
      fieldContext.strokeStyle = state.hsv.v > 0.55 ? '#fff' : '#000';
      fieldContext.lineWidth = 2;
      fieldContext.stroke();
    }

    function setPickerFromPointer(event) {
      const rect = ui['opp-color-field'].getBoundingClientRect();
      state.hsv.s = clamp((event.clientX - rect.left) / rect.width);
      state.hsv.v = clamp(1 - (event.clientY - rect.top) / rect.height);
      renderPicker();
      updateValueInputs();
      saveState();
    }

    function renderExtracted() {
      ui['opp-extracted'].innerHTML = '';
      state.originalPalette.forEach((color, index) => {
        const swatch = doc.createElement('button');
        swatch.type = 'button';
        swatch.className = 'opp-swatch';
        swatch.style.background = rgbToHex(color);
        swatch.title = `Load ${rgbToHex(color)} into the picker`;
        swatch.innerHTML = `<span>${rgbToHex(color)}</span>`;
        swatch.addEventListener('click', () => {
          ui['opp-extracted'].querySelectorAll('.opp-swatch').forEach((item) => item.classList.remove('active'));
          swatch.classList.add('active');
          setCurrentRgb(color, 1);
        });
        ui['opp-extracted'].appendChild(swatch);
        if (index === 0) swatch.classList.add('active');
      });
    }

    function updateRoles() {
      state.roles = ROLE_NAMES.map((role, index) => ({
        role,
        original: state.roleOriginal[index] || state.originalPalette[index] || { r: 0, g: 0, b: 0 },
        suggested: state.suggested[index] || state.roleOriginal[index] || { r: 0, g: 0, b: 0 }
      }));
      ui['opp-css'].textContent = buildCss(state.roles);
    }

    function renderComparison() {
      updateRoles();
      const background = state.roles[0]?.suggested || { r: 0, g: 0, b: 0 };
      ui['opp-comparison'].innerHTML = '';
      state.roles.forEach((entry) => {
        const row = doc.createElement('div');
        row.className = 'opp-role-row';
        const ratio = contrastRatio(entry.suggested, background);
        row.innerHTML = `
          <span class="opp-role-name">${entry.role}</span>
          <button type="button" class="opp-role-color" data-original title="${rgbToHex(entry.original)}" style="background:${rgbToHex(entry.original)}"></button>
          <span class="opp-role-arrow">→</span>
          <button type="button" class="opp-role-color" data-suggested title="${rgbToHex(entry.suggested)}" style="background:${rgbToHex(entry.suggested)}"></button>
          <span class="opp-role-score">${entry.role === 'Background' ? 'Base colour' : `${ratio.toFixed(2)}:1 vs background`}</span>
        `;
        row.querySelector('[data-original]').addEventListener('click', () => setCurrentRgb(entry.original, 1));
        row.querySelector('[data-suggested]').addEventListener('click', () => setCurrentRgb(entry.suggested, 1));
        ui['opp-comparison'].appendChild(row);
      });
    }

    function drawPreview(target, imageData) {
      const targetContext = target.getContext('2d');
      targetContext.clearRect(0, 0, target.width, target.height);
      targetContext.fillStyle = '#090a09';
      targetContext.fillRect(0, 0, target.width, target.height);
      if (!imageData) return;
      const offscreen = doc.createElement('canvas');
      offscreen.width = imageData.width;
      offscreen.height = imageData.height;
      offscreen.getContext('2d').putImageData(imageData, 0, 0);
      const scale = Math.min(target.width / imageData.width, target.height / imageData.height);
      const width = imageData.width * scale;
      const height = imageData.height * scale;
      targetContext.drawImage(offscreen, (target.width - width) / 2, (target.height - height) / 2, width, height);
    }

    function renderPreviews() {
      drawPreview(ui['opp-before'], state.baseline);
      drawPreview(ui['opp-after'], state.recoloured || state.baseline);
    }

    function generatePalette(usePicker = false) {
      if (!state.originalPalette.length) captureBaseline(true);
      snapshotUndo();
      const source = state.originalPalette.map((color) => ({ ...color }));
      if (usePicker) {
        let primaryIndex = 0;
        let strongestSaturation = -1;
        source.forEach((color, index) => {
          const saturation = rgbToHsl(color).s;
          if (saturation > strongestSaturation) {
            strongestSaturation = saturation;
            primaryIndex = index;
          }
        });
        source[primaryIndex] = currentRgb();
      }
      const generated = generateSuggestedPalette(source, ui['opp-preset'].value);
      state.roleOriginal = generated.roleOriginal;
      state.suggested = generated.suggested;
      renderComparison();
      saveState();
      setStatus(`${PRESETS.find(([value]) => value === ui['opp-preset'].value)?.[1] || 'Auto'} palette generated.`);
    }

    function applyRecolour() {
      if (!state.baseline) captureBaseline(true);
      if (!state.baseline) return;
      snapshotUndo();
      if (!state.suggested.length) generatePalette(false);
      state.applying = true;
      const sourceData = cloneImageData(state.baseline);
      const output = cloneImageData(state.baseline);
      const sourceLabs = state.originalPalette.map(rgbToOklab);
      const targetByPalette = state.originalPalette.map((sourceColor) => {
        let best = 0;
        let bestDistance = Infinity;
        state.roleOriginal.forEach((roleColor, index) => {
          const distance = perceptualDistance(sourceColor, roleColor);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        return rgbToOklab(state.suggested[best] || sourceColor);
      });

      for (let index = 0; index < sourceData.data.length; index += 4) {
        if (sourceData.data[index + 3] < 8) continue;
        const pixel = { r: sourceData.data[index], g: sourceData.data[index + 1], b: sourceData.data[index + 2] };
        const pixelLab = rgbToOklab(pixel);
        let nearest = 0;
        let nearestDistance = Infinity;
        for (let paletteIndex = 0; paletteIndex < sourceLabs.length; paletteIndex += 1) {
          const colorLab = sourceLabs[paletteIndex];
          const distance = Math.hypot((pixelLab.L - colorLab.L) * 1.25, pixelLab.a - colorLab.a, pixelLab.b - colorLab.b);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = paletteIndex;
          }
        }
        const sourceLab = sourceLabs[nearest];
        const targetLab = targetByPalette[nearest];
        const recoloured = oklabToRgb({
          L: clamp(targetLab.L + (pixelLab.L - sourceLab.L) * 0.68),
          a: targetLab.a + (pixelLab.a - sourceLab.a) * 0.16,
          b: targetLab.b + (pixelLab.b - sourceLab.b) * 0.16
        });
        output.data[index] = Math.round(recoloured.r);
        output.data[index + 1] = Math.round(recoloured.g);
        output.data[index + 2] = Math.round(recoloured.b);
      }

      context.putImageData(output, 0, 0);
      state.recoloured = cloneImageData(output);
      state.applying = false;
      state.lastCanvasSignature = '';
      ui['opp-download'].disabled = false;
      renderPreviews();
      saveState();
      setStatus('Image recoloured with the generated palette.');
    }

    function restoreSnapshot(snapshot) {
      if (!snapshot) return;
      state.applying = true;
      if (snapshot.imageData && snapshot.imageData.width === canvas.width && snapshot.imageData.height === canvas.height) {
        context.putImageData(snapshot.imageData, 0, 0);
      }
      state.originalPalette = snapshot.originalPalette.map((color) => ({ ...color }));
      state.roleOriginal = snapshot.roleOriginal.map((color) => ({ ...color }));
      state.suggested = snapshot.suggested.map((color) => ({ ...color }));
      state.recoloured = snapshot.recoloured ? cloneImageData(snapshot.imageData) : null;
      state.applying = false;
      ui['opp-download'].disabled = !state.recoloured;
      renderExtracted();
      renderComparison();
      renderPreviews();
      saveState();
    }

    function resetAll() {
      snapshotUndo();
      state.applying = true;
      if (state.baseline && state.baseline.width === canvas.width && state.baseline.height === canvas.height) context.putImageData(state.baseline, 0, 0);
      state.applying = false;
      state.recoloured = null;
      ui['opp-download'].disabled = true;
      const generated = generateSuggestedPalette(state.originalPalette, ui['opp-preset'].value);
      state.roleOriginal = generated.roleOriginal;
      state.suggested = generated.suggested;
      renderComparison();
      renderPreviews();
      saveState();
      setStatus('Palette and image reset.');
    }

    function parseValueInput(id, value) {
      const text = String(value || '').trim();
      let result = null;
      if (id === 'opp-hex') result = parseHex(text);
      if (id === 'opp-rgb') {
        const numbers = text.match(/-?\d*\.?\d+/g)?.map(Number) || [];
        if (numbers.length >= 3) result = { rgb: { r: numbers[0], g: numbers[1], b: numbers[2] }, alpha: numbers[3] ?? state.alpha };
      }
      if (id === 'opp-hsl') {
        const numbers = text.match(/-?\d*\.?\d+/g)?.map(Number) || [];
        if (numbers.length >= 3) result = { rgb: hslToRgb({ h: numbers[0], s: numbers[1] / 100, l: numbers[2] / 100 }), alpha: numbers[3] ?? state.alpha };
      }
      if (id === 'opp-hsv') {
        const numbers = text.match(/-?\d*\.?\d+/g)?.map(Number) || [];
        if (numbers.length >= 3) result = { rgb: hsvToRgb({ h: numbers[0], s: numbers[1] / 100, v: numbers[2] / 100 }), alpha: numbers[3] ?? state.alpha };
      }
      if (id === 'opp-oklch') {
        const numbers = text.match(/-?\d*\.?\d+/g)?.map(Number) || [];
        if (numbers.length >= 3) result = { rgb: oklchToRgb({ L: numbers[0], C: numbers[1], h: numbers[2] }), alpha: numbers[3] ?? state.alpha };
      }
      if (!result) return false;
      setCurrentRgb(result.rgb, clamp(result.alpha), true);
      return true;
    }

    function restoreSaved() {
      const saved = readSavedState();
      if (!saved) return;
      if (saved.preset && PRESETS.some(([value]) => value === saved.preset)) ui['opp-preset'].value = saved.preset;
      if (saved.hsv) state.hsv = saved.hsv;
      if (Number.isFinite(saved.alpha)) state.alpha = saved.alpha;
      const parsePalette = (values) => Array.isArray(values) ? values.map((value) => parseHex(value)?.rgb).filter(Boolean) : [];
      const originals = parsePalette(saved.originalPalette);
      const roleOriginal = parsePalette(saved.roleOriginal);
      const suggested = parsePalette(saved.suggested);
      if (originals.length >= 6) state.originalPalette = originals.slice(0, 6);
      if (roleOriginal.length >= 6) state.roleOriginal = roleOriginal.slice(0, 6);
      if (suggested.length >= 6) state.suggested = suggested.slice(0, 6);
      renderPicker();
      updateValueInputs();
      renderExtracted();
      renderComparison();
      if (saved.recolouredDataUrl && saved.canvasWidth === canvas.width && saved.canvasHeight === canvas.height) {
        const image = new view.Image();
        image.onload = () => {
          state.applying = true;
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          try { state.recoloured = cloneImageData(context.getImageData(0, 0, canvas.width, canvas.height)); } catch (error) {}
          state.applying = false;
          try { state.lastCanvasSignature = canvasSignature(); } catch (error) {}
          ui['opp-download'].disabled = !state.recoloured;
          renderPreviews();
        };
        image.src = saved.recolouredDataUrl;
      }
    }

    ui['opp-color-field'].addEventListener('pointerdown', (event) => {
      ui['opp-color-field'].setPointerCapture(event.pointerId);
      setPickerFromPointer(event);
    });
    ui['opp-color-field'].addEventListener('pointermove', (event) => {
      if (ui['opp-color-field'].hasPointerCapture(event.pointerId)) setPickerFromPointer(event);
    });
    ui['opp-hue'].addEventListener('input', () => {
      state.hsv.h = Number(ui['opp-hue'].value);
      renderPicker();
      updateValueInputs();
      saveState();
    });
    ui['opp-alpha'].addEventListener('input', () => {
      state.alpha = Number(ui['opp-alpha'].value) / 100;
      updateValueInputs();
      saveState();
    });
    ['opp-hex', 'opp-rgb', 'opp-hsl', 'opp-hsv', 'opp-oklch'].forEach((id) => {
      ui[id].addEventListener('change', () => {
        if (!parseValueInput(id, ui[id].value)) {
          ui[id].setCustomValidity('Enter a valid colour value.');
          ui[id].reportValidity();
          ui[id].setCustomValidity('');
          updateValueInputs();
        }
      });
    });
    panel.querySelectorAll('[data-copy]').forEach((button) => {
      button.addEventListener('click', () => copyText(doc, doc.getElementById(button.dataset.copy).value, button));
    });

    ui['opp-pick-image'].addEventListener('click', () => {
      state.pickFromImage = !state.pickFromImage;
      ui['opp-pick-image'].classList.toggle('opp-pick-active', state.pickFromImage);
      ui['opp-pick-image'].textContent = state.pickFromImage ? 'Click image…' : 'Pick from image';
      setStatus(state.pickFromImage ? 'Click the main preview to sample a colour.' : 'Image picker cancelled.');
    });

    canvas.addEventListener('click', (event) => {
      if (!state.pickFromImage) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((event.clientX - rect.left) / rect.width * canvas.width);
      const y = Math.floor((event.clientY - rect.top) / rect.height * canvas.height);
      const pixel = context.getImageData(clamp(x, 0, canvas.width - 1), clamp(y, 0, canvas.height - 1), 1, 1).data;
      setCurrentRgb({ r: pixel[0], g: pixel[1], b: pixel[2] }, pixel[3] / 255);
      state.pickFromImage = false;
      ui['opp-pick-image'].classList.remove('opp-pick-active');
      ui['opp-pick-image'].textContent = 'Pick from image';
      setStatus(`Picked ${rgbToHex({ r: pixel[0], g: pixel[1], b: pixel[2] })}.`);
    }, true);

    ui['opp-refresh'].addEventListener('click', () => {
      if (state.recoloured && state.baseline) {
        state.applying = true;
        context.putImageData(state.baseline, 0, 0);
        state.applying = false;
      }
      captureBaseline(true);
      setStatus('Image colours refreshed.');
    });
    ui['opp-generate'].addEventListener('click', () => generatePalette(false));
    ui['opp-use-picker'].addEventListener('click', () => generatePalette(true));
    ui['opp-recolour'].addEventListener('click', applyRecolour);
    ui['opp-undo'].addEventListener('click', () => {
      const snapshot = state.undo.pop();
      if (!snapshot) {
        setStatus('Nothing to undo.');
        return;
      }
      restoreSnapshot(snapshot);
      setStatus('Previous palette state restored.');
    });
    ui['opp-reset'].addEventListener('click', resetAll);
    ui['opp-download'].addEventListener('click', () => {
      if (!state.recoloured) return;
      const anchor = doc.createElement('a');
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = 'image-calculator-recoloured.png';
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    });
    ui['opp-copy-css'].addEventListener('click', () => copyText(doc, ui['opp-css'].textContent, ui['opp-copy-css']));
    ui['opp-preset'].addEventListener('change', () => generatePalette(false));

    doc.addEventListener('input', (event) => {
      if (panel.contains(event.target) || state.applying) return;
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(() => captureBaseline(false), 260);
    }, true);
    doc.addEventListener('change', (event) => {
      if (panel.contains(event.target) || state.applying) return;
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(() => captureBaseline(false), event.target?.id === 'file-input' ? 420 : 260);
    }, true);

    renderPicker();
    updateValueInputs();
    setTimeout(() => {
      captureBaseline(true);
      restoreSaved();
      renderPreviews();
    }, 360);
  }

  window.OrganonImagePalette = { install };
})();
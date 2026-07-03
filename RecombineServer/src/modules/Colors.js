exports.hexToRgb = function hexToRbg(color) {
  const num = parseInt(color.replace(/^#/, ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = (num) & 255;
  return { r, g, b }
}
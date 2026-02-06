export function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map(char => char + char)
          .join('')
      : normalized;
  const int = Number.parseInt(value, 16);
  if (Number.isNaN(int) || value.length !== 6) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

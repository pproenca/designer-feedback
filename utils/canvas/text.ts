export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [''];
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  paragraphs.forEach((paragraph, index) => {
    if (!paragraph.trim()) {
      lines.push('');
      return;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    words.forEach(word => {
      if (!word) return;
      if (ctx.measureText(word).width > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        const segments = breakLongWord(ctx, word, maxWidth);
        segments.slice(0, -1).forEach(segment => lines.push(segment));
        currentLine = segments[segments.length - 1] ?? '';
        return;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    if (index < paragraphs.length - 1) lines.push('');
  });

  return lines;
}

export function breakLongWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  maxWidth: number
): string[] {
  const segments: string[] = [];
  let current = '';

  for (const char of word) {
    const testSegment = current + char;
    if (ctx.measureText(testSegment).width <= maxWidth || !current) {
      current = testSegment;
    } else {
      segments.push(current);
      current = char;
    }
  }

  if (current) segments.push(current);
  return segments;
}

export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let low = 0;
  let high = text.length;

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low > 0 ? text.slice(0, low) + '…' : '';
}

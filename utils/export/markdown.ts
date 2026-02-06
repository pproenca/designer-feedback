import type {Annotation} from '@/types';
import type {FeedbackCategory} from '@/types';
import {getCategoryConfig} from '@/shared/categories';

type NotesMarkdownMeta = {
  title?: string;
  url?: string;
  exportedAt?: string;
};

/** Severity order for markdown export (most severe first). */
const SEVERITY_ORDER: FeedbackCategory[] = [
  'bug',
  'accessibility',
  'suggestion',
  'question',
];

export function generateNotesMarkdown(
  annotations: Annotation[],
  meta: NotesMarkdownMeta = {}
): string {
  const lines: string[] = [];
  const pageTitle = meta.title ?? 'Untitled page';
  const pageUrl = meta.url ?? 'Unknown';
  const exportedAt = meta.exportedAt ?? new Date().toLocaleString();

  lines.push('# Feedback Notes');
  lines.push('');
  lines.push(`**Page:** ${pageTitle}`);
  lines.push(`**URL:** ${pageUrl}`);
  lines.push(`**Exported:** ${exportedAt}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Annotations');
  lines.push('');

  // Index each annotation with its original 1-based position
  const indexed = annotations.map((a, i) => ({annotation: a, index: i + 1}));

  // Group by category in severity order
  for (const category of SEVERITY_ORDER) {
    const group = indexed.filter(
      ({annotation}) => annotation.category === category
    );
    if (group.length === 0) continue;

    const config = getCategoryConfig(category);
    lines.push(`### ${config.label}`);
    lines.push('');

    for (const {annotation, index} of group) {
      lines.push(`#### ${index}. ${config.label} - ${annotation.element}`);
      lines.push('');
      lines.push(annotation.comment);
      lines.push('');
      if (annotation.elementPath) {
        lines.push(`*Element:* \`${annotation.elementPath}\``);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

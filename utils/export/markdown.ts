import type { Annotation } from '@/types';
import { getCategoryConfig } from '@/shared/categories';

export function generateNotesMarkdown(annotations: Annotation[]): string {
  const lines: string[] = [];


  lines.push('# Feedback Notes');
  lines.push('');
  lines.push(`**Page:** ${document.title}`);
  lines.push(`**URL:** ${window.location.href}`);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Agent Steps');
  lines.push('');
  lines.push('1. Review the annotations and map each item to the relevant code area.');
  lines.push('2. Triage by category (bugs/accessibility first), then implement fixes in order.');
  lines.push('3. Validate the UI against annotated elements and update tests if needed.');
  lines.push('4. Report status for each annotation number and flag open questions.');
  lines.push('');
  lines.push('## Annotations');
  lines.push('');


  annotations.forEach((annotation, index) => {
    const config = getCategoryConfig(annotation.category);
    lines.push(`### ${index + 1}. ${config.label} - ${annotation.element}`);
    lines.push('');
    lines.push(annotation.comment);
    lines.push('');
    if (annotation.elementPath) {
      lines.push(`*Element:* \`${annotation.elementPath}\``);
      lines.push('');
    }
  });

  return lines.join('\n');
}

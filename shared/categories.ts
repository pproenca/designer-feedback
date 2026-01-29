import type { FeedbackCategory } from '@/types';

export type CategoryConfig = {
  id: FeedbackCategory;
  label: string;
  color: string;
  emoji: string;
};

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'bug',
    label: 'Bug',
    color: '#FF3B30',
    emoji: '🐛',
  },
  {
    id: 'suggestion',
    label: 'Suggestion',
    color: '#3C82F7',
    emoji: '💡',
  },
  {
    id: 'question',
    label: 'Question',
    color: '#FFD60A',
    emoji: '❓',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    color: '#AF52DE',
    emoji: '♿',
  },
];

export const getCategoryConfig = (id: FeedbackCategory): CategoryConfig => {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
};

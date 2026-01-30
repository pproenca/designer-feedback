import { Accessibility, Bug, CircleHelp, Lightbulb, type LucideIcon } from 'lucide-react';
import type { FeedbackCategory } from '@/types';

export type CategoryConfig = {
  id: FeedbackCategory;
  label: string;
  color: string;
  Icon: LucideIcon;
  tw: {
    bg: string;
    text: string;
  };
};

export const CATEGORIES: CategoryConfig[] = [
  {
    id: 'bug',
    label: 'Bug',
    color: '#FF3B30',
    Icon: Bug,
    tw: {
      bg: 'bg-df-red',
      text: 'text-df-red',
    },
  },
  {
    id: 'suggestion',
    label: 'Suggestion',
    color: '#3C82F7',
    Icon: Lightbulb,
    tw: {
      bg: 'bg-df-blue',
      text: 'text-df-blue',
    },
  },
  {
    id: 'question',
    label: 'Question',
    color: '#FFD60A',
    Icon: CircleHelp,
    tw: {
      bg: 'bg-df-yellow',
      text: 'text-df-yellow',
    },
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    color: '#AF52DE',
    Icon: Accessibility,
    tw: {
      bg: 'bg-df-purple',
      text: 'text-df-purple',
    },
  },
];

export const getCategoryConfig = (id: FeedbackCategory): CategoryConfig => {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
};

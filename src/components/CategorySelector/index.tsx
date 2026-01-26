import type { FeedbackCategory } from '@/types';
import { CATEGORIES, getCategoryConfig } from '@/shared/categories';
import { IconBug, IconLightbulb, IconQuestion, IconAccessibility } from '../Icons';
import styles from './styles.module.scss';

interface CategorySelectorProps {
  selected: FeedbackCategory;
  onChange: (category: FeedbackCategory) => void;
  lightMode?: boolean;
}

const CATEGORY_ICONS: Record<FeedbackCategory, React.ComponentType<{ size?: number }>> = {
  bug: IconBug,
  suggestion: IconLightbulb,
  question: IconQuestion,
  accessibility: IconAccessibility,
};

export function CategorySelector({
  selected,
  onChange,
  lightMode = false,
}: CategorySelectorProps) {
  return (
    <div className={`${styles.selector} ${lightMode ? styles.light : ''}`}>
      {CATEGORIES.map((category) => {
        const Icon = CATEGORY_ICONS[category.id];
        const isSelected = selected === category.id;

        return (
          <button
            key={category.id}
            type="button"
            className={`${styles.categoryButton} ${isSelected ? styles.selected : ''}`}
            style={{
              '--category-color': category.color,
            } as React.CSSProperties}
            onClick={() => onChange(category.id)}
          >
            <Icon size={16} />
            <span className={styles.label}>{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CategoryBadge({
  category,
  size = 'small',
}: {
  category: FeedbackCategory;
  size?: 'small' | 'medium';
}) {
  const config = getCategoryConfig(category);

  return (
    <span
      className={`${styles.badge} ${styles[size]}`}
      style={{ backgroundColor: config.color }}
    >
      {config.emoji} {config.label}
    </span>
  );
}

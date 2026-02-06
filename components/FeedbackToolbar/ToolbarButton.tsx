import type {ReactNode} from 'react';
import {clsx} from 'clsx';

interface ToolbarButtonProps {
  icon: ReactNode;
  label: string;
  tooltipId: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaDescribedBy?: string;
}

export function ToolbarButton({
  icon,
  label,
  tooltipId,
  onClick,
  disabled,
  danger,
  ariaPressed,
  ariaExpanded,
}: ToolbarButtonProps) {
  return (
    <div className="relative flex items-center justify-center group">
      <button
        className={clsx('btn-toolbar', danger && 'danger')}
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        onClick={onClick}
        disabled={disabled}
      >
        {icon}
      </button>
      <span className="tooltip" role="tooltip" id={tooltipId}>
        {label}
      </span>
    </div>
  );
}

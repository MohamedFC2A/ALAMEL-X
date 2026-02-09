import type { ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';

type GameButtonVariant = 'primary' | 'ghost' | 'icon' | 'danger' | 'safe';
type GameButtonSize = 'md' | 'lg' | 'hero' | 'icon';

interface GameButtonProps extends HTMLMotionProps<'button'> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  icon?: ReactNode;
  children: ReactNode;
}

export function GameButton({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled = false,
  type = 'button',
  ...rest
}: GameButtonProps) {
  const classes = Array.from(
    new Set(['game-button', `game-button--${variant}`, `game-button--${size}`, className].filter(Boolean)),
  ).join(' ');

  return (
    <motion.button
      type={type}
      className={classes}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12 }}
      {...rest}
    >
      {icon ? <span className="game-button__icon">{icon}</span> : null}
      <span className="game-button__label">{children}</span>
    </motion.button>
  );
}

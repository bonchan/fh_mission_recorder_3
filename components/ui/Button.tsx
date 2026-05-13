import React, { forwardRef, useState, useRef, useEffect } from 'react';

// Define the available variants
type ButtonVariant = 'primary' | 'danger' | 'warning' | 'sad' | 'success' | 'outline' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  width?: string | number;

  requireConfirm?: boolean;
  confirmText?: React.ReactNode;
  confirmVariant?: ButtonVariant;
  confirmTimeout?: number;

  stopPropagate?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  isLoading = false,
  children,
  width = '100%',
  style,
  disabled,
  onClick,

  // Confirmation defaults
  requireConfirm = false,
  confirmText = 'CONFIRM',
  confirmVariant = 'danger',
  confirmTimeout = 2000,

  stopPropagate = true,

  ...props
}, ref) => {

  // Internal confirmation state
  const [isConfirming, setIsConfirming] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timeout to prevent memory leaks if the button unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagate) {
      e.stopPropagation();
    }
    // If confirmation isn't required, just fire the standard onClick
    if (!requireConfirm) {
      onClick?.(e);
      return;
    }

    if (!isConfirming) {
      // First click: Enter confirm mode and start the timer
      e.preventDefault();
      setIsConfirming(true);
      timerRef.current = setTimeout(() => {
        setIsConfirming(false);
      }, confirmTimeout);
    } else {
      // Second click: Execute the action and reset
      if (timerRef.current) clearTimeout(timerRef.current);
      setIsConfirming(false);
      onClick?.(e);
    }
  };

  // Dynamically swap the active variant and text based on state
  const activeVariant = isConfirming ? confirmVariant : variant;
  const activeChildren = isConfirming ? confirmText : children;

  // Color Templates (Variants)
  const variants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { backgroundColor: '#0066ff', color: '#fff' },
    warning: { backgroundColor: '#dce655', color: '#000000' },
    sad: { backgroundColor: '#333', color: '#ffffff' },
    danger: { backgroundColor: '#ff4d4f', color: '#fff' },
    success: { backgroundColor: '#52c41a', color: '#fff' },
    outline: { backgroundColor: 'transparent', border: '1px solid #444', color: '#eee' },
    ghost: { backgroundColor: 'transparent', color: '#0066ff' }
  };

  const baseStyle: React.CSSProperties = {
    width,
    padding: '10px',
    marginBottom: '6px',
    border: 'none',
    borderRadius: '4px',
    cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
    opacity: (disabled || isLoading) ? 0.6 : 1,
    fontSize: '12px',
    transition: 'all 0.2s ease', // Changed to 'all' so colors crossfade smoothly
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    ...variants[activeVariant], // Apply the active template
    ...style
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      style={baseStyle}
      onClick={handleClick}
      {...props}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) e.currentTarget.style.filter = 'brightness(1.1)';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {isLoading ? (
        <>
          <span className="spinner" />
          Wait...
        </>
      ) : (
        activeChildren
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
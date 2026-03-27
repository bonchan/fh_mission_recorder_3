import React, { forwardRef } from 'react';

// Define the available variants
type ButtonVariant = 'primary' | 'danger' | 'warning' | 'sad' | 'success' | 'outline' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  width?: string | number;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  isLoading = false,
  children,
  width = '100%',
  style,
  disabled,
  ...props
}, ref) => {

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
    // fontWeight: 'bold',
    cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
    opacity: (disabled || isLoading) ? 0.6 : 1,
    fontSize: '12px',
    transition: 'filter 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    ...variants[variant], // Apply the template
    ...style // Allow manual overrides
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      style={baseStyle}
      {...props}
      onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
      onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
    >
      {isLoading ? (
        <>
          <span className="spinner" /> {/* You could add a small CSS spinner here */}
          Wait...
        </>
      ) : (
        children
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
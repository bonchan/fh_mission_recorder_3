import './VisualButton.css';

interface VisualButtonProps {
  label: string;
  type?: 'button' | 'switch';
  active?: boolean;  // Used for 'button'
  value?: number;    // Used for 'switch'
}

export default function VisualButton({ label, type = 'button', active = false, value = 0 }: VisualButtonProps) {
  
  if (type === 'switch') {
    return (
      <div className="hw-switch-wrapper">
        <span className="hw-switch-label">{label}</span>
        <span className="hw-switch-value">
          {/* Format the switch value cleanly. You can map 1, 0, -1 to UP/MID/DWN if you prefer! */}
          {value > 0 ? '+1' : value < 0 ? '-1' : ' 0'}
        </span>
      </div>
    );
  }

  return (
    <div className={`hw-button ${active ? 'is-pressed' : ''}`}>
      {label}
    </div>
  );
}
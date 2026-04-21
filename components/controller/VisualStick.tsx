import './VisualStick.css';

interface VisualStickProps {
  x?: number;
  y?: number;
  label: string;
  mode?: '2d' | 'horizontal'; // NEW: Add mode selector
}

export default function VisualStick({ x = 0, y = 0, label, mode = '2d' }: VisualStickProps) {
  // X maps left to right natively
  const left = `${((x + 1) / 2) * 100}%`;
  
  // Y inverts because 0% is the top of the CSS box.
  // If it's a horizontal slider, lock the dot to the vertical center (50%).
  const top = mode === 'horizontal' ? '50%' : `${((-y + 1) / 2) * 100}%`;

  return (
    <div className="stick-col">
      <span className="stick-label">{label}</span>
      {/* Dynamically assign the class based on the mode */}
      <div className={`stick-wrapper stick-wrapper-${mode}`}>
        <div className="stick-dot" style={{ left, top }}></div>
      </div>
    </div>
  );
}
import { COLORS, WIDTHS } from '../hooks/useWhiteboard';

interface ToolbarProps {
  currentUser: { color: string; width: number };
  setTool: (color: string, width: number) => void;
}

export function Toolbar({ currentUser, setTool }: ToolbarProps) {
  const tools = [
    { color: COLORS.BLACK, width: WIDTHS.PEN, label: 'Black' },
    { color: COLORS.RED, width: WIDTHS.PEN, label: 'Red' },
    { color: COLORS.BLUE, width: WIDTHS.PEN, label: 'Blue' },
    { color: COLORS.GREEN, width: WIDTHS.PEN, label: 'Green' },
    { color: COLORS.ERASER, width: WIDTHS.ERASER, label: 'Eraser' },
  ];

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-2 flex gap-2 border border-gray-200">
      {tools.map((tool) => (
        <button
          key={tool.label}
          onClick={() => setTool(tool.color, tool.width)}
          className={`w-10 h-10 rounded-full border-2 transition-transform flex items-center justify-center ${
            currentUser.color === tool.color && currentUser.width === tool.width
              ? 'scale-110 border-gray-800'
              : 'border-transparent hover:scale-105'
          }`}
          style={{ backgroundColor: tool.color === COLORS.ERASER ? '#f0f0f0' : tool.color }}
          title={tool.label}
        >
          {tool.color === COLORS.ERASER && (
            <span className="text-xs font-bold text-gray-500">Eraser</span>
          )}
        </button>
      ))}
    </div>
  );
}

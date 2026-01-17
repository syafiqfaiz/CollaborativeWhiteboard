import { useEffect, useRef, MouseEvent } from 'react';
import type { Stroke, UserCursor } from '../types';

interface CanvasProps {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  peers: UserCursor[];
  startDrawing: (x: number, y: number) => void;
  draw: (x: number, y: number) => void;
  endDrawing: () => void;
  moveCursor: (x: number, y: number) => void;
}

export function Canvas({
  strokes,
  currentStroke,
  peers,
  startDrawing,
  draw,
  endDrawing,
  moveCursor,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Helper to draw a stroke
  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 1) return;
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fill background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw history
    strokes.forEach(stroke => drawStroke(ctx, stroke));

    // Draw current stroke
    if (currentStroke) {
      drawStroke(ctx, currentStroke);
    }

  }, [strokes, currentStroke]);

  const getCoordinates = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: MouseEvent) => {
    const { x, y } = getCoordinates(e);
    startDrawing(x, y);
    moveCursor(x, y);
  };

  const handleMouseMove = (e: MouseEvent) => {
    const { x, y } = getCoordinates(e);
    if (e.buttons === 1) { // Left click held
      draw(x, y);
    }
    moveCursor(x, y);
  };

  const handleMouseUp = () => {
    endDrawing();
  };

  return (
    <div className="relative w-full h-full bg-gray-200 overflow-auto flex justify-center items-center">
      <div className="relative shadow-2xl bg-white shrink-0" style={{ width: 1920, height: 1080 }}>
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className="w-full h-full cursor-crosshair block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
          {/* Peer Cursors Overlay */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
             {peers.map(peer => (
                 <div
                    key={peer.id}
                    className="absolute flex flex-col items-start z-50"
                    style={{
                        transform: `translate(${peer.x}px, ${peer.y}px)`,
                        transition: 'transform 0.05s linear'
                    }}
                 >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-blue-500 drop-shadow-md"
                    >
                        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L11.7841 12.3673H5.65376Z" fill="currentColor" stroke="white"/>
                    </svg>
                    <span className="bg-blue-500 text-white text-xs px-1 rounded shadow-md ml-4 -mt-2 whitespace-nowrap">
                        {peer.name}
                    </span>
                 </div>
             ))}
          </div>
      </div>
    </div>
  );
}

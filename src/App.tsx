import { useWhiteboard } from './hooks/useWhiteboard';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { LoginModal } from './components/LoginModal';

function App() {
  const {
    strokes,
    currentStroke,
    peers,
    currentUser,
    startDrawing,
    draw,
    moveCursor,
    endDrawing,
    setTool,
    setDisplayName,
  } = useWhiteboard();

  if (!currentUser.name) {
    return <LoginModal onJoin={setDisplayName} />;
  }

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Canvas
        strokes={strokes}
        currentStroke={currentStroke}
        peers={peers}
        startDrawing={startDrawing}
        draw={draw}
        endDrawing={endDrawing}
        moveCursor={moveCursor}
      />
      <Toolbar currentUser={currentUser} setTool={setTool} />
    </div>
  );
}

export default App;

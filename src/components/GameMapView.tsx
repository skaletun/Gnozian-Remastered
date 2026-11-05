import type { GameState } from '../game/types';
import type { GraphicsSettings } from '../game/settingsConstants';
import type { CameraState } from '../game/hexMetrics';
import { memo } from 'react';
import GameCanvas from './GameCanvas';

interface Props {
  gameState: GameState;
  liveCamera?: CameraState;
  onTileClick: (q: number, r: number, mods?: { altKey?: boolean; shiftKey?: boolean }) => void;
  onClearSelection?: () => void;
  onCameraChange: (cam: CameraState) => void;
  graphics?: GraphicsSettings;
  cameraControls?: {
    sensitivity: number;
    sensitivityX: number;
    sensitivityY: number;
    zoomSensitivity: number;
    invertX: boolean;
    invertY: boolean;
  };
  onViewportSize?: (width: number, height: number) => void;
  localViewerCivIndex?: number;
  interactionTick?: number;
}

function GameMapView(props: Props) {
  return (
    <GameCanvas
      gameState={props.gameState}
      liveCamera={props.liveCamera}
      onTileClick={props.onTileClick}
      onClearSelection={props.onClearSelection}
      onCameraChange={props.onCameraChange}
      graphics={props.graphics}
      cameraControls={props.cameraControls}
      onViewportSize={props.onViewportSize}
      localViewerCivIndex={props.localViewerCivIndex}
      interactionTick={props.interactionTick}
    />
  );
}

export default memo(GameMapView);
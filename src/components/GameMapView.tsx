import type { GameState } from '../game/types';
import type { GraphicsSettings } from '../game/settingsConstants';
import type { WorldCameraView } from '../game/hexGeometry';
import { memo } from 'react';
import GameCanvas from './GameCanvas';

interface Props {
  gameState: GameState;
  onTileClick: (q: number, r: number, mods?: { altKey?: boolean; shiftKey?: boolean }) => void;
  onClearSelection?: () => void;
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
  onWorldCameraChange?: (camera: WorldCameraView) => void;
  focusHex?: {q:number;r:number;requestId:number}|null;
}

function GameMapView(props: Props) {
  return (
    <GameCanvas
      gameState={props.gameState}
      onTileClick={props.onTileClick}
      onClearSelection={props.onClearSelection}
      graphics={props.graphics}
      cameraControls={props.cameraControls}
      onViewportSize={props.onViewportSize}
      localViewerCivIndex={props.localViewerCivIndex}
      interactionTick={props.interactionTick}
      onWorldCameraChange={props.onWorldCameraChange}
      focusHex={props.focusHex}
    />
  );
}

export default memo(GameMapView);
import React from "react";
import { SceneCardItem, Scene } from "./SceneCard";

export function SceneCards(props: {
  scenes: Scene[];
  selectedSceneId?: number | null;
  onSelectScene?: (sceneId: number) => void;
}) {
  const { scenes, selectedSceneId, onSelectScene } = props;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-200">Scenes</div>
        <div className="text-xs text-slate-500 tabular-nums">{scenes.length} total</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {scenes.map((s) => (
          <SceneCardItem
            key={s.scene_id}
            scene={s}
            selected={selectedSceneId === s.scene_id}
            onSelect={onSelectScene}
          />
        ))}
      </div>
    </div>
  );
}


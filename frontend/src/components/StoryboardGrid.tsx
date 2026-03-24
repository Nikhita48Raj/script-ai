import React from "react";
import { motion } from "framer-motion";

type SceneLite = any;

interface StoryboardGridProps {
  scenes: SceneLite[];
}

export function StoryboardGrid({ scenes }: StoryboardGridProps) {
  if (scenes.length === 0) {
    return (
      <div className="text-center text-slate-500 py-10 text-sm">
        No scenes available for storyboard.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2 pb-10">
      {scenes.map((scene, i) => (
        <motion.div
          key={scene.scene_id}
          className="glass border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col group relative"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
          whileHover={{ y: -4, borderColor: "rgba(56,189,248,0.4)" }}
        >
          {/* Top placeholder frame drawing area */}
          <div className="h-40 bg-black/60 relative border-b border-slate-800/80 flex items-center justify-center p-4">
            <div className="absolute top-2 left-2 text-[10px] uppercase tracking-widest text-slate-500 bg-black/50 px-2 py-0.5 rounded backdrop-blur-md">
              S{scene.scene_id}
            </div>
            
            {/* Camera Viewfinder Elements */}
            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/50 px-2 py-0.5 rounded backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
              <span className="text-[9px] text-red-500 tracking-widest font-bold">REC</span>
            </div>
            <div className="absolute bottom-2 left-2 text-[9px] text-slate-400 font-mono tracking-widest bg-black/50 px-1 rounded">
              TCR 01:0{scene.scene_id}:4{i}
            </div>
            <div className="absolute bottom-2 right-2 text-[9px] text-slate-500 font-mono tracking-widest bg-black/50 px-1 rounded">
              ISO 800
            </div>

            {/* Crosshairs & Rule of thirds */}
            <div className="absolute inset-0 pointer-events-none border border-black/80 h-full w-full" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/5 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-1/3 h-px bg-white/5 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/5 pointer-events-none" />
            <div className="absolute inset-y-0 right-1/3 w-px bg-white/5 pointer-events-none" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="w-4 h-px bg-white" />
              <div className="w-px h-4 bg-white absolute" />
            </div>

            {scene.shot_type ? (
              <div className="text-center z-10 transition-transform group-hover:scale-105 duration-500">
                <div className="text-sm font-bold text-slate-200 tracking-widest drop-shadow-md">
                  {scene.shot_type}
                </div>
                <div className="text-[10px] text-amber-400 mt-1 uppercase tracking-widest font-semibold drop-shadow">
                  {scene.camera_angle}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-600 z-10">No Shot Data</div>
            )}
            
            {/* Play Button Overlay on Hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm z-20 cursor-pointer">
              <div className="w-12 h-12 rounded-full border border-sky-400/50 flex items-center justify-center bg-sky-900/40 hover:bg-sky-500/30 transition-colors shadow-[0_0_20px_rgba(56,189,248,0.2)]">
                <div className="w-0 h-0 border-t-4 border-t-transparent border-l-[6px] border-l-sky-100 border-b-4 border-b-transparent ml-1" />
              </div>
            </div>
          </div>

          {/* Details below frame */}
          <div className="p-4 flex-1 flex flex-col">
            <div className="font-semibold text-[13px] text-slate-200 uppercase tracking-wide truncate">
              {scene.location}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              EXT/INT: {(scene.type || "").substring(0, 3)} - TIME: {scene.time}
            </div>

            <div className="mt-3 text-[11px] text-slate-300 line-clamp-3 leading-relaxed border-l-2 border-slate-700 pl-2">
              {scene.text_excerpt || (scene.ai_summary || "Scene content missing.")}
            </div>

            {scene.storyboard_prompt && (
              <div className="mt-4 p-2.5 rounded-xl bg-cinema-gold/5 border border-cinema-gold/10">
                <div className="text-[9px] uppercase tracking-widest text-cinema-gold/60 font-bold mb-1">Director's Vision</div>
                <div className="text-[10px] text-cinema-gold/90 italic leading-relaxed">
                  "{scene.storyboard_prompt}"
                </div>
              </div>
            )}

            <div className="mt-auto pt-3 flex items-center justify-between text-[10px] text-amber-200/80 uppercase tracking-widest">
              <span>{Math.round(Number(scene.complexity || 0) * 100)}% CX</span>
              <span>{scene.lighting_notes || "DAYLIGHT"}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

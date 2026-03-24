import React from "react";
import { motion } from "framer-motion";

interface CastingBoardProps {
  castList: string[];
}

export function CastingBoard({ castList }: CastingBoardProps) {
  if (!castList || castList.length === 0) {
    return (
      <div className="text-center text-slate-500 py-10 text-sm">
        No casting information available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {castList.map((characterName, i) => (
        <motion.div
          key={i}
          className="glass border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col relative"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          whileHover={{ scale: 1.02, borderColor: "rgba(251,191,36,0.3)" }}
        >
          <div className="aspect-[3/4] bg-gradient-to-br from-slate-900 via-slate-900 to-black relative">
            {/* Artistic Studio Placeholder */}
            <div className="absolute inset-x-0 bottom-1/4 top-[15%] mx-auto w-[55%] border-t border-l border-r border-slate-700/50 rounded-t-full bg-gradient-to-b from-slate-800/80 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/90 to-transparent" />
            
            {/* Top Right Status Badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${i % 3 === 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'}`} />
              <span className="text-[8px] text-slate-300 tracking-widest uppercase font-semibold">
                {i % 3 === 0 ? "CAST" : "AUDITION"}
              </span>
            </div>

            <div className="absolute bottom-4 left-4 right-4 group-hover:bottom-5 transition-all">
              <div className="text-[10px] text-amber-500 uppercase tracking-widest font-semibold drop-shadow">
                {i === 0 ? "Lead Role" : "Supporting"}
              </div>
              <div className="text-sm font-bold text-slate-50 truncate mt-0.5 drop-shadow-md">
                {characterName}
              </div>
              
              {/* Role Match Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[9px] text-slate-400 mb-1 font-mono">
                  <span>ROLE MATCH</span>
                  <span>{85 - i * 5}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-300" 
                    style={{ width: `${85 - i * 5}%` }}
                  />
                </div>
              </div>

              {/* Barcode Deco */}
              <div className="mt-3 opacity-30 flex gap-0.5 h-3">
                {[...Array(20)].map((_, idx) => (
                  <div key={idx} className="bg-slate-300 h-full" style={{ width: Math.random() > 0.5 ? '2px' : '1px' }} />
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

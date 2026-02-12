
import React from 'react';
import { CreativeBrief } from '../types';

interface BriefCardProps {
  brief: CreativeBrief;
}

const BriefCard: React.FC<BriefCardProps> = ({ brief }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
      {/* Shot List Section */}
      <div className="md:col-span-2 glass-panel p-6 rounded-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center">
          <i className="fa-solid fa-clapperboard text-sky-400 mr-3"></i>
          The Production Plan: What to Make
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {brief.shotList.map((item, i) => (
            <div key={i} className="bg-slate-800/40 border border-slate-700 p-4 rounded-xl hover:bg-slate-800/60 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase px-2 py-1 bg-sky-500/10 text-sky-400 rounded">
                  {item.type}
                </span>
                <span className="text-slate-500 text-xs">Idea #{i+1}</span>
              </div>
              <h4 className="font-bold text-slate-100 mb-1">{item.idea}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Style & Color Section */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center">
          <i className="fa-solid fa-palette text-indigo-400 mr-3"></i>
          Visual Aesthetics
        </h3>
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Trending Palette</p>
          <div className="flex space-x-2">
            {brief.colorPalette.map((color, i) => (
              <div 
                key={i} 
                className="group relative w-full h-12 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: color }}
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-[10px] px-1 rounded text-white font-mono">
                  {color}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Composition Strategy</p>
          <ul className="space-y-2">
            {brief.compositionTips.map((t, i) => (
              <li key={i} className="flex items-start">
                <i className="fa-solid fa-chevron-right text-indigo-500 mt-1 mr-2 text-[10px]"></i>
                <span className="text-sm text-slate-300">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Market Gaps */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <i className="fa-solid fa-magnifying-glass-chart text-emerald-400 mr-2"></i>
          Current Market Gaps
        </h3>
        <p className="text-xs text-slate-500 mb-4">High demand, low supply niches:</p>
        <ul className="space-y-3">
          {brief.missingNiches.map((n, i) => (
            <li key={i} className="flex items-center space-x-3 p-3 bg-slate-900/40 rounded-lg border border-slate-800">
              <i className="fa-solid fa-arrow-trend-up text-emerald-400"></i>
              <span className="text-sm text-slate-200">{n}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Keywords */}
      <div className="glass-panel p-6 rounded-2xl md:col-span-2">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <i className="fa-solid fa-tags text-sky-400 mr-2"></i>
          Metadata Optimization
        </h3>
        <div className="flex flex-wrap gap-2">
          {brief.suggestedKeywords.map((kw, i) => (
            <span key={i} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-full text-sm border border-slate-700 hover:border-sky-400 transition-all cursor-default">
              {kw}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BriefCard;

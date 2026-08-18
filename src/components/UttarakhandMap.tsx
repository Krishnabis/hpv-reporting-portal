import React, { useState, useRef } from 'react';

export interface DistrictMapData {
  district: string;
  coveragePct: number;
  lineListPct: number;
  vaccinated: number;
  lineList: number;
  target: number;
}

interface Props {
  data: DistrictMapData[];
  selectedKpi: 'coverage' | 'linelist';
}

// Approximate SVG paths for Uttarakhand's 13 districts (viewBox 0 0 480 360)
const PATHS: Record<string, string> = {
  'Uttarkashi':        'M38,22 L155,18 L168,68 L142,108 L90,115 L38,90 Z',
  'Chamoli':           'M155,18 L285,14 L298,30 L280,98 L196,108 L168,68 Z',
  'Pithoragarh':       'M285,14 L448,22 L460,50 L444,142 L360,158 L304,140 L280,98 Z',
  'Tehri Garhwal':     'M90,115 L142,108 L168,68 L196,108 L190,162 L158,178 L108,170 Z',
  'Rudraprayag':       'M196,108 L280,98 L304,140 L284,175 L232,185 L200,164 Z',
  'Bageshwar':         'M304,140 L360,158 L350,222 L290,232 L270,200 L284,175 Z',
  'Dehradun':          'M38,90 L90,115 L108,170 L78,208 L38,180 Z',
  'Haridwar':          'M38,180 L78,208 L88,252 L38,262 Z',
  'Pauri Garhwal':     'M108,170 L158,178 L190,162 L232,185 L220,245 L166,265 L118,252 L88,252 L78,208 Z',
  'Almora':            'M232,185 L284,175 L270,200 L290,232 L260,272 L210,265 L204,248 Z',
  'Champawat':         'M360,158 L444,142 L450,202 L420,242 L370,252 L350,222 Z',
  'Nainital':          'M166,265 L220,245 L210,265 L260,272 L270,322 L190,335 L150,310 Z',
  'Udham Singh Nagar': 'M260,272 L370,252 L420,242 L430,302 L390,342 L270,322 Z',
};

const LABELS: Record<string, [number, number, string]> = {
  'Uttarkashi':        [96,  62,  'Uttarkashi'],
  'Chamoli':           [220, 60,  'Chamoli'],
  'Pithoragarh':       [370, 84,  'Pithoragarh'],
  'Tehri Garhwal':     [138, 140, 'Tehri G.'],
  'Rudraprayag':       [248, 142, 'Rudrap.'],
  'Bageshwar':         [318, 190, 'Bageshwar'],
  'Dehradun':          [62,  150, 'Dehradun'],
  'Haridwar':          [55,  222, 'Haridwar'],
  'Pauri Garhwal':     [154, 218, 'Pauri G.'],
  'Almora':            [240, 232, 'Almora'],
  'Champawat':         [404, 200, 'Champawat'],
  'Nainital':          [212, 300, 'Nainital'],
  'Udham Singh Nagar': [348, 298, 'USN'],
};

export function getTier(pct: number) {
  if (pct >= 90) return {
    label: 'Champions', fill: '#16a34a', fillLight: '#bbf7d0',
    bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', dot: 'bg-green-500'
  };
  if (pct >= 70) return {
    label: 'High Performing', fill: '#2563eb', fillLight: '#bfdbfe',
    bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', dot: 'bg-blue-500'
  };
  if (pct >= 30) return {
    label: 'Progressing', fill: '#d97706', fillLight: '#fde68a',
    bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', dot: 'bg-amber-500'
  };
  return {
    label: 'Aspirational', fill: '#dc2626', fillLight: '#fecaca',
    bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', dot: 'bg-red-500'
  };
}

export function UttarakhandMap({ data, selectedKpi }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const dataMap: Record<string, DistrictMapData> = {};
  data.forEach(d => { dataMap[d.district] = d; });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredData = hovered ? dataMap[hovered] : null;

  return (
    <div ref={containerRef} className="relative w-full select-none" onMouseMove={handleMouseMove}>
      <svg viewBox="0 0 480 355" className="w-full" style={{ display: 'block' }}>
        <defs>
          <filter id="districtShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#00000022" />
          </filter>
        </defs>

        {Object.entries(PATHS).map(([name, path]) => {
          const d = dataMap[name];
          const pct = d ? (selectedKpi === 'coverage' ? d.coveragePct : d.lineListPct) : 0;
          const tier = getTier(pct);
          const isHovered = hovered === name;
          const hasData = !!d;
          return (
            <path
              key={name}
              d={path}
              fill={isHovered ? tier.fill : (hasData ? tier.fill + 'CC' : '#cbd5e1')}
              stroke="white"
              strokeWidth={isHovered ? 2.5 : 1.5}
              strokeLinejoin="round"
              filter="url(#districtShadow)"
              style={{ cursor: 'pointer', transition: 'fill 0.15s, stroke-width 0.1s' }}
              onMouseEnter={() => setHovered(name)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {Object.entries(LABELS).map(([name, [x, y, label]]) => (
          <text
            key={`lbl-${name}`}
            x={x}
            y={y}
            textAnchor="middle"
            fontSize={hovered === name ? 9 : 8}
            fontFamily="system-ui, sans-serif"
            fontWeight={hovered === name ? '700' : '600'}
            fill="white"
            style={{ pointerEvents: 'none', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }}
          >
            {label}
          </text>
        ))}
      </svg>

      {hovered && hoveredData && (
        <div
          className="absolute z-20 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 pointer-events-none"
          style={{
            left: Math.min(mousePos.x + 14, (containerRef.current?.offsetWidth ?? 400) - 175),
            top: Math.max(mousePos.y - 90, 2),
            minWidth: '168px',
          }}
        >
          <p className="font-extrabold text-slate-900 text-xs mb-2 border-b border-slate-100 pb-1.5">{hovered}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-3">
              <span className="text-[11px] text-slate-500">HPV Target</span>
              <span className="text-[11px] font-bold text-slate-800 font-mono">{hoveredData.target.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-[11px] text-slate-500">Line List</span>
              <span className="text-[11px] font-bold text-emerald-700 font-mono">{hoveredData.lineList.toLocaleString()} <span className="text-slate-400">({hoveredData.lineListPct}%)</span></span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-[11px] text-slate-500">Vaccinated</span>
              <span className="text-[11px] font-bold text-purple-700 font-mono">{hoveredData.vaccinated.toLocaleString()} <span className="text-slate-400">({hoveredData.coveragePct}%)</span></span>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
              {(() => {
                const pct = selectedKpi === 'coverage' ? hoveredData.coveragePct : hoveredData.lineListPct;
                const t = getTier(pct);
                return (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.bg} ${t.text}`}>
                    {t.label}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

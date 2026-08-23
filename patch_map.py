import re

with open('src/components/UttarakhandMap.tsx', 'r') as f:
    content = f.read()

# 1. Add aggregate calculation right before return
calc_str = """
  // Compute Division Aggregates
  const garhwalData = Object.entries(dataMap).filter(([name]) => GARHWAL.includes(name)).map(([_, d]) => d);
  const kumaonData = Object.entries(dataMap).filter(([name]) => KUMAON.includes(name)).map(([_, d]) => d);

  const getAggregate = (arr: any[]) => {
    const target = arr.reduce((sum, d) => sum + (d?.hpv_target || 0), 0);
    const ll = arr.reduce((sum, d) => sum + (d?.line_list_received || 0), 0);
    const vacc = arr.reduce((sum, d) => sum + (d?.beneficiaries_vaccinated || 0), 0);
    const val = kpiForMap === 'coverage' ? vacc : ll;
    const divBy = kpiForMap === 'coverage' ? ll : target;
    const pct = divBy > 0 ? Math.round((val / divBy) * 100) : 0;
    return { count: val, pct };
  };

  const gAgg = getAggregate(garhwalData);
  const kAgg = getAggregate(kumaonData);

  return (
"""
content = re.sub(r'\s*return \(\s*<div\s+className="relative', calc_str + r'    <div className="relative', content)

# 2. Add legend in JSX
legend_str = """    <div className="relative w-full h-[500px] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setHoveredDistrict(null); setIsDragging(false); }}
      ref={containerRef}
    >
      {/* Legend Top Right */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur p-3 rounded-xl shadow-sm border border-slate-200 text-right pointer-events-none">
        <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Divisions</h4>
        <div className="flex flex-col gap-2 items-end">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-600">Garhwal ({gAgg.pct}%)</div>
              <div className="text-[10px] text-slate-400">Count: {gAgg.count.toLocaleString()}</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-pink-400"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-600">Kumaon ({kAgg.pct}%)</div>
              <div className="text-[10px] text-slate-400">Count: {kAgg.count.toLocaleString()}</div>
            </div>
            <div className="w-3 h-3 rounded-full bg-[#8b4513]"></div>
          </div>
        </div>
      </div>
"""
content = re.sub(r'\s*<div\s+className="relative w-full h-\[500px\].*?ref=\{containerRef\}\n\s*>\n.*?\{/\* Legend removed per user request \*/\}', legend_str, content, flags=re.DOTALL)


# 3. Add outlines back
outline_str = """          {/* Garhwal outer division border only */}
          {Object.entries(PATHS).filter(([name]) => GARHWAL.includes(name)).map(([name, path]) => (
            <path
              key={`outline-${name}`}
              d={path}
              fill="none"
              stroke="pink"
              strokeWidth={4}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
        </g>"""
content = re.sub(r'\s*</g>\s*\{\/\* Kumaon Division', outline_str + '\n\n        {/* Kumaon Division', content)

outline_str_2 = """          {/* Kumaon outer division border only */}
          {Object.entries(PATHS).filter(([name]) => KUMAON.includes(name)).map(([name, path]) => (
            <path
              key={`outline-${name}`}
              d={path}
              fill="none"
              stroke="#8b4513"
              strokeWidth={4}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          ))}
        </g>"""
content = re.sub(r'\s*</g>\s*\{\/\* Labels — offset per division', outline_str_2 + '\n\n        {/* Labels — offset per division', content)


with open('src/components/UttarakhandMap.tsx', 'w') as f:
    f.write(content)

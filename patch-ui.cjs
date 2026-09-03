const fs = require('fs');
const file = 'src/pages/VaccineStockMonitoringReport.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add leastOnTop state
content = content.replace(
  "const [activeActionFilter, setActiveActionFilter] = useState<'ALL' | 'CRITICAL' | 'REORDER'>('ALL');",
  "const [activeActionFilter, setActiveActionFilter] = useState<'ALL' | 'CRITICAL' | 'REORDER'>('ALL');\n  const [leastOnTop, setLeastOnTop] = useState(false);"
);

// 2. Modify filtered to include leastOnTop sort
const originalFiltered = `const filtered = useMemo(() => {
    if (activeActionFilter === 'ALL') return filteredBySearch;
    return filteredBySearch.filter(r => {
      const a = (r.action_required || '').toLowerCase();
      if (activeActionFilter === 'CRITICAL') return a.includes('critical');
      if (activeActionFilter === 'REORDER') return a.includes('re-order') || a.includes('replenish');
      return true;
    });
  }, [filteredBySearch, activeActionFilter]);`;

const newFiltered = `const filtered = useMemo(() => {
    let result = filteredBySearch;
    if (activeActionFilter !== 'ALL') {
      result = result.filter(r => {
        const a = (r.action_required || '').toLowerCase();
        if (activeActionFilter === 'CRITICAL') return a.includes('critical');
        if (activeActionFilter === 'REORDER') return a.includes('re-order') || a.includes('replenish');
        return true;
      });
    }
    if (leastOnTop) {
      result = [...result].sort((a, b) => (a.stock_availability_pct || 0) - (b.stock_availability_pct || 0));
    }
    return result;
  }, [filteredBySearch, activeActionFilter, leastOnTop]);`;
content = content.replace(originalFiltered, newFiltered);

// 3. Add button in the search area
const originalSearch = `<div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input type="text" placeholder="Search by name..." value={search}`;
const newSearch = `<div className="flex items-center gap-2">
              <button
                onClick={() => { setLeastOnTop(!leastOnTop); setCurrentPage(1); }}
                className={\`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors \${
                  leastOnTop ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }\`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                Least on Top
              </button>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input type="text" placeholder="Search by name..." value={search}`;
content = content.replace(originalSearch, newSearch);

// Also close the new flex div for search
content = content.replace(
  `</div>\n\n          <div className="overflow-auto flex-1 min-h-0">`,
  `</div>\n            </div>\n\n          <div className="overflow-auto flex-1 min-h-0">`
);

// 4. Update row rendering for pink highlight
const originalRowRender = `const isEven = idx % 2 === 0;
                  const rowBg = isEven ? 'bg-white' : 'bg-slate-50/60';
                  return (
                    <tr key={row.id} className={\`border-b border-slate-100 hover:bg-purple-50/30 transition-colors group \${rowBg}\`}>
                      <td className={\`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 \${rowBg} group-hover:bg-purple-50/30\`}>`;
const newRowRender = `const isEven = idx % 2 === 0;
                  const isDistrictStore = row.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE';
                  const rowClass = isDistrictStore ? 'bg-pink-50/50 hover:bg-pink-100/50' : (isEven ? 'bg-white hover:bg-purple-50/30' : 'bg-slate-50/60 hover:bg-purple-50/30');
                  return (
                    <tr key={row.id} className={\`border-b border-slate-100 transition-colors group \${rowClass}\`}>
                      <td className={\`px-2 py-1.5 font-bold text-slate-800 sticky left-0 z-[5] border-r border-slate-100 \${rowClass}\`}>`;
content = content.replace(originalRowRender, newRowRender);

// 5. Add tfoot totals
const tfoot = `
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800 border-t border-slate-300">
                  <td className="px-2 py-2 sticky left-0 z-[5] bg-slate-100 border-r border-slate-200 uppercase tracking-wider text-xs">Total</td>
                  <td className="px-2 py-2 text-right">{fmt(filtered.reduce((s, r) => s + (r.annual_requirement || 0), 0))}</td>
                  <td className="px-2 py-2 text-right">{fmt(filtered.reduce((s, r) => s + (r.opening_stock || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-blue-700">{fmt(filtered.reduce((s, r) => s + (r.vaccine_received || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-orange-700">{fmt(filtered.reduce((s, r) => s + (r.vaccinations || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-red-600">{fmt(filtered.reduce((s, r) => s + (r.wastage || 0), 0))}</td>
                  <td className="px-2 py-2 text-center">—</td>
                  <td className="px-2 py-2 text-right">{fmt(filtered.reduce((s, r) => s + (r.estimated_stock_balance || 0), 0))}</td>
                  <td className="px-2 py-2 text-right text-green-700">{fmt(filtered.reduce((s, r) => s + (r.month_end_stock_reported || 0), 0))}</td>
                  <td className="px-2 py-2 text-center text-red-600">—</td>
                  <td className="px-2 py-2 text-center">
                    {filtered.reduce((s, r) => s + (r.annual_requirement || 0), 0) > 0 
                      ? \`\${fmt((filtered.reduce((s, r) => s + (r.estimated_stock_balance || 0), 0) / filtered.reduce((s, r) => s + (r.annual_requirement || 0), 0)) * 100, 1)}%\`
                      : '—'}
                  </td>
                  <td className="px-2 py-2 text-center"></td>
                </tr>
              </tfoot>
`;

content = content.replace(`</tbody>\n            </table>`, `</tbody>${tfoot}\n            </table>`);

// 6. Need to import TrendingDown if not imported
if (!content.includes('TrendingDown')) {
    content = content.replace("import { Search,", "import { Search, TrendingDown,");
}

fs.writeFileSync(file, content);
console.log('Patched UI successfully');

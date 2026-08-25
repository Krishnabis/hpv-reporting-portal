import React from 'react';
import { UttarakhandMap, getTier as ukTier } from './UttarakhandMap';
import { UPMap, getTier as upTier } from './UPMap';

interface Props {
  stateName: string;
  data: any[];
  selectedKpi: 'coverage' | 'linelist' | 'both';
  selectedDistrict?: string | null;
  onDistrictClick?: (districtName: string) => void;
}

export const StateMap: React.FC<Props> = ({ stateName, data, selectedKpi, selectedDistrict, onDistrictClick }) => {
  const name = stateName?.toLowerCase().trim() || '';

  if (name === 'uttarakhand') {
    return <UttarakhandMap data={data} selectedKpi={selectedKpi} selectedDistrict={selectedDistrict} onDistrictClick={onDistrictClick} />;
  }
  
  if (name === 'uttar pradesh' || name === 'up') {
    return <UPMap data={data} selectedKpi={selectedKpi} selectedDistrict={selectedDistrict} onDistrictClick={onDistrictClick} />;
  }

  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-200">
      <div className="text-center p-6">
        <h3 className="text-lg font-bold text-slate-700 mb-2">Map Not Available</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          The interactive map for <span className="font-semibold text-slate-800">{stateName}</span> is not yet configured.
        </p>
      </div>
    </div>
  );
};

export const getTier = ukTier; // Fallback export for other files if needed

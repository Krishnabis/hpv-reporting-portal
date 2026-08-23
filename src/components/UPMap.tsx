import React, { useMemo } from 'react';

interface Props {
  data: any[];
  selectedKpi: 'coverage' | 'linelist' | 'both';
}

const UP_DISTRICTS = [
  'Agra', 'Aligarh', 'Ayodhya', 'Ambedkar Nagar', 'Auraiya', 'Azamgarh', 'Badaun', 'Baghpat', 'Bahraich', 'Ballia',
  'Balrampur', 'Banda', 'Barabanki', 'Bareilly', 'Basti', 'Bijnor', 'Bulandshahr', 'Chandauli', 'Chhatrapati Shahuji Maharaj Nagar', 'Chitrakoot',
  'Deoria', 'Etah', 'Etawah', 'Farrukhabad', 'Fatehpur', 'Firozabad', 'Gautam Buddha Nagar', 'Ghaziabad', 'Ghazipur', 'Gonda',
  'Gorakhpur', 'Hamirpur', 'Hardoi', 'Jalaun', 'Jaunpur', 'Jhansi', 'Jyotiba Phule Nagar', 'Kannauj', 'Kanpur Nagar', 'Kanshi Ram Nagar',
  'Kaushambi', 'Kushinagar', 'Lakhimpur Kheri', 'Lalitpur', 'Lucknow', 'Mahamaya Nagar', 'Maharajganj', 'Mahoba', 'Mainpuri', 'Mathura',
  'Mau', 'Meerut', 'Mirzapur', 'Moradabad', 'Muzaffarnagar', 'Pilibhit', 'Pratapgarh', 'Prayagraj', 'Raebareli', 'Rambai Nagar',
  'Rampur', 'Saharanpur', 'Sant Kabir Nagar', 'Sant Ravidas Nagar', 'Shahjahanpur', 'Shravasti', 'Siddharthnagar', 'Sitapur', 'Sonbhadra', 'Sultanpur',
  'Unnao', 'Varanasi'
];

export const getTier = (val: number) => {
  if (val >= 90) return { color: '#6EE7B7', label: 'Champion 90%+' };
  if (val >= 70) return { color: '#93C5FD', label: 'High Performance 70-90%' };
  if (val >= 30) return { color: '#FDE047', label: 'Progressing 30-70%' };
  return { color: '#FCA5A5', label: 'Aspirational 0-30%' };
};

export const UPMap: React.FC<Props> = ({ data, selectedKpi }) => {
  const districtData = useMemo(() => {
    const map = new Map();
    data.forEach(d => {
      if (d.district) {
        map.set(d.district.toLowerCase(), d);
      }
    });
    return map;
  }, [data]);

  // Using a placeholder image or object tag for the SVG if they load it in public/
  // The easiest way to make it interactive before the SVG exists is just returning a message,
  // but they want the SVG IDs mapped.
  // We can render an object tag and access its SVG DOM once loaded, but that requires complex refs.
  // Instead, since we don't have the SVG file content to inline it like UttarakhandMap,
  // we will render a placeholder for now, and tell the user we need to inline the SVG paths when they upload it.

  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-slate-50 rounded-2xl relative border-2 border-dashed border-slate-200">
      <div className="text-center p-6">
        <h3 className="text-lg font-bold text-slate-700 mb-2">Uttar Pradesh Map</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Please upload <code className="bg-slate-200 px-1 py-0.5 rounded text-rose-600">UP_MAP.svg</code> to the public folder. We will then process the file and map IDs 1-72 to the districts.
        </p>
      </div>
    </div>
  );
};

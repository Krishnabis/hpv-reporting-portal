import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    code = f.read()

# Replace the import
code = code.replace(
    "import { UttarakhandMap, getTier } from '../components/UttarakhandMap';",
    "import { StateMap, getTier } from '../components/StateMap';"
)

# Replace the map component call
# Look for <UttarakhandMap
# It might look like:
# <UttarakhandMap
#   data={districtRanking}
#   selectedKpi={selectedKpi}
# />

bad_map = """                    <UttarakhandMap
                      data={districtRanking}
                      selectedKpi={selectedKpi}
                    />"""

# We need the state name to pass to StateMap.
# Since dashboardStateId gives us the ID, we can look up the name in statesList.
# adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name : 'Uttarakhand') : adminUser?.state_name
good_map = """                    <StateMap
                      stateName={adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || 'India')}
                      data={districtRanking}
                      selectedKpi={selectedKpi}
                    />"""

code = code.replace(bad_map, good_map)

# Also need to fix the title above the map: Uttarakhand Overview
bad_map_title = """<MapPin className="w-4 h-4 text-blue-500" /> Uttarakhand Overview"""
good_map_title = """<MapPin className="w-4 h-4 text-blue-500" /> {adminUser?.role === 'SUPER_ADMIN' ? (dashboardStateId ? statesList.find(s => String(s.id) === dashboardStateId)?.name || 'India' : 'India') : (adminUser?.state_name || 'State')} Overview"""
code = code.replace(bad_map_title, good_map_title)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(code)


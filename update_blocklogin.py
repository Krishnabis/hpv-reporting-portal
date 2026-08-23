import re

code = open('src/pages/BlockLogin.tsx').read()

# Add state variables
code = code.replace(
    "const [districts, setDistricts] = useState<OptionItem[]>([]);",
    "const [states, setStates] = useState<OptionItem[]>([]);\n  const [districts, setDistricts] = useState<OptionItem[]>([]);"
)
code = code.replace(
    "const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);",
    "const [selectedState, setSelectedState] = useState<OptionItem | null>(null);\n  const [selectedDistrict, setSelectedDistrict] = useState<OptionItem | null>(null);"
)

# Fetch states
fetch_old = """    Promise.all([
      fetch('/api/locations/districts').then(res => res.json()),
      fetch('/api/locations/blocks').then(res => res.json())
    ])
      .then(([districtsData, blocksData]) => {"""

fetch_new = """    Promise.all([
      fetch('/api/locations/states').then(res => res.json()),
      fetch('/api/locations/districts').then(res => res.json()),
      fetch('/api/locations/blocks').then(res => res.json())
    ])
      .then(([statesData, districtsData, blocksData]) => {
        const mappedStates = statesData.map((s: any) => ({
          id: s.id,
          name: s.name
        }));
        setStates(mappedStates);
        
        const lastStateId = localStorage.getItem('hpv_last_state_id');
        if (lastStateId) {
          const found = mappedStates.find((s: any) => String(s.id) === lastStateId);
          if (found) setSelectedState(found);
        }
"""

code = code.replace(fetch_old, fetch_new)
code = code.replace("subtitle: `(State: Uttarakhand, District: ${b.district_name})`,", "subtitle: `(District: ${b.district_name})`,")

# Add handles
handle_block = """  // Handle Block selection
  const handleBlockChange = (item: OptionItem | null) => {
    setSelectedBlock(item);
  };"""

handle_state = """  const handleStateChange = (item: OptionItem | null) => {
    setSelectedState(item);
    if (item) {
      localStorage.setItem('hpv_last_state_id', String(item.id));
    } else {
      localStorage.removeItem('hpv_last_state_id');
    }
    setSelectedDistrict(null);
    setSelectedBlock(null);
  };

  const handleBlockChange = (item: OptionItem | null) => {
    setSelectedBlock(item);
  };"""

code = code.replace(handle_block, handle_state)

# Render Dropdown
dropdown_old = """                  <div className="space-y-4">
                    <SearchableSelect
                      options={availableBlockOptions}
                      value={selectedBlock}
                      onChange={handleBlockChange}
                      placeholder="Search for a Block or City..."
                      label="Select Block/City"
                    />
                  </div>"""

dropdown_new = """                  <div className="space-y-4">
                    <SearchableSelect
                      options={states}
                      value={selectedState}
                      onChange={handleStateChange}
                      placeholder="Search for a State..."
                      label="Select State"
                    />
                    
                    {selectedState && (
                      <SearchableSelect
                        options={availableBlockOptions.filter((b: any) => {
                          const dist = districts.find(d => String(d.id) === String(b.district_id));
                          return dist && String((dist as any).state_id) === String(selectedState.id);
                        })}
                        value={selectedBlock}
                        onChange={handleBlockChange}
                        placeholder="Search for a Block or City..."
                        label="Select Block/City"
                      />
                    )}
                  </div>"""

# Wait, `districts` mapped items don't have `state_id`! Let's update district mapping.
code = code.replace("""const mappedDistricts = districtsData.map((d: any) => ({
          id: d.id,
          name: d.name
        }));""", """const mappedDistricts = districtsData.map((d: any) => ({
          id: d.id,
          name: d.name,
          state_id: d.state_id
        }));""")

code = code.replace(dropdown_old, dropdown_new)

open('src/pages/BlockLogin.tsx', 'w').write(code)

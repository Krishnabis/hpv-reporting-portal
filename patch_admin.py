import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Add facilityId state
content = re.sub(
    r"const \[newAdminDistrictId, setNewAdminDistrictId\] = useState\(''\);",
    "const [newAdminDistrictId, setNewAdminDistrictId] = useState('');\n  const [newAdminFacilityId, setNewAdminFacilityId] = useState('');",
    content
)

# Add VACCINE_MANAGER role option
content = re.sub(
    r'<option value="ADMIN">State Admin</option>\s*<option value="SUPER_ADMIN">Super Admin</option>',
    '<option value="ADMIN">State Admin</option>\n                    <option value="VACCINE_MANAGER">Vaccine Manager</option>\n                    <option value="SUPER_ADMIN">Super Admin</option>',
    content
)

# Make state select show for VACCINE_MANAGER too and reset facility
content = re.sub(
    r"\{newAdminRole === 'ADMIN' && \(\s*<div className=\"flex flex-col gap-1\">\s*<label className=\"text-\[10px\] font-bold uppercase tracking-wider text-slate-600\">State \*</label>\s*<select value=\{newAdminStateId\} onChange=\{e => \{ setNewAdminStateId\(e.target.value\); setNewAdminDistrictId\(''\); \}\} required",
    "{(newAdminRole === 'ADMIN' || newAdminRole === 'VACCINE_MANAGER') && (\n                  <div className=\"flex flex-col gap-1\">\n                    <label className=\"text-[10px] font-bold uppercase tracking-wider text-slate-600\">State *</label>\n                    <select value={newAdminStateId} onChange={e => { setNewAdminStateId(e.target.value); setNewAdminDistrictId(''); setNewAdminFacilityId(''); }} required",
    content
)

# Add Facility select for VACCINE_MANAGER
facility_select = """                {newAdminRole === 'VACCINE_MANAGER' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Facility *</label>
                    <select value={newAdminFacilityId} onChange={e => setNewAdminFacilityId(e.target.value)} required
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:border-emerald-600 disabled:opacity-50">
                      <option value="">{newAdminStateId ? 'Select Facility' : 'Select State first'}</option>
                      {newAdminStateId && cclList.filter(c => String(c.state_id) === String(newAdminStateId) && (String(c.unit_level) === '1' || String(c.unit_level) === '2')).map(c => (
                        <option key={c.id} value={c.id}>{c.facility_name} {c.districts?.name ? '- ' + c.districts.name : ''}</option>
                      ))}
                    </select>
                  </div>
                )}"""

content = re.sub(
    r"\{newAdminRole === 'ADMIN' && \(\s*<div className=\"flex flex-col gap-1\">\s*<label className=\"text-\[10px\] font-bold uppercase tracking-wider text-slate-600\">District \(Optional\)</label>[\s\S]*?</div>\s*\)\}",
    "\\g<0>\n" + facility_select,
    content
)

# Add newAdminFacilityId to the fetch payload
content = re.sub(
    r"body: JSON\.stringify\(\{ name: newAdminName, username: newAdminUsername, password: newAdminPassword, role: newAdminRole, state_id: newAdminStateId, district_id: newAdminDistrictId \}\)",
    "body: JSON.stringify({ name: newAdminName, username: newAdminUsername, password: newAdminPassword, role: newAdminRole, state_id: newAdminStateId, district_id: newAdminDistrictId, facility_id: newAdminFacilityId })",
    content
)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(content)


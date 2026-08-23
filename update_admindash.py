import re

code = open('src/pages/AdminDashboard.tsx').read()

# Add dashboardStateId state
code = code.replace(
    "const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);",
    "const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);\n  const [dashboardStateId, setDashboardStateId] = useState<string>('');\n  const [states, setStates] = useState<any[]>([]);"
)

# Fetch states in fetchMasterLocations
code = code.replace(
    "fetch('/api/locations/blocks').then(r => r.json())",
    "fetch('/api/locations/states').then(r => r.json()).then(data => setStates(data)),\n      fetch('/api/locations/blocks').then(r => r.json())"
)

# Make APIs include state_id
# We'll replace URLs inside fetches
def replace_url(match):
    url = match.group(1)
    if '?' in url:
        return f"fetch(`{url}&state_id=${{dashboardStateId}}`"
    else:
        return f"fetch(`{url}?state_id=${{dashboardStateId}}`"

code = re.sub(r"fetch\('(/api/admin/population)'", r"fetch(`\1?state_id=${dashboardStateId}`", code)
code = re.sub(r"fetch\(`(/api/admin/kpis\?date=\$\{filterDate\})`", r"fetch(`\1&state_id=${dashboardStateId}`", code)
code = re.sub(r"fetch\(`(/api/admin/reports/generate\?\$\{params\.toString\(\)\})`", r"fetch(`\1&state_id=${dashboardStateId}`", code)

# Update useEffect dependencies to include dashboardStateId
code = code.replace(
    "useEffect(() => {\n    if (adminUser) {\n      fetchKpis();\n      fetchReport();\n    }\n  }, [filterDate, adminUser]);",
    "useEffect(() => {\n    if (adminUser) {\n      fetchKpis();\n      fetchReport();\n      fetchAlertCount();\n    }\n  }, [filterDate, adminUser, dashboardStateId]);"
)

# For "Add New Admin" state selection
code = code.replace(
    "const [newAdminPassword, setNewAdminPassword] = useState('');",
    "const [newAdminPassword, setNewAdminPassword] = useState('');\n  const [newAdminStateId, setNewAdminStateId] = useState('');"
)
code = code.replace(
    "body: JSON.stringify({ username: newAdminUser, name: newAdminName, password: newAdminPassword, role: newAdminRole })",
    "body: JSON.stringify({ username: newAdminUser, name: newAdminName, password: newAdminPassword, role: newAdminRole, state_id: newAdminStateId || undefined })"
)

# Header Title and State Dropdown
header_old = """                  <h2 className="text-3xl font-bold text-teal-800">
                    Monitoring Dashboard: <span className="text-fuchsia-800">Uttarakhand</span>
                  </h2>"""
header_new = """                  <div className="flex items-center space-x-4">
                    <h2 className="text-3xl font-bold text-teal-800 flex items-center">
                      Monitoring Dashboard: 
                      {adminUser?.role === 'SUPER_ADMIN' ? (
                        <select
                          value={dashboardStateId}
                          onChange={(e) => setDashboardStateId(e.target.value)}
                          className="ml-2 bg-transparent text-fuchsia-800 font-bold border-b-2 border-fuchsia-300 focus:outline-none focus:border-fuchsia-600 pb-1"
                        >
                          <option value="">All States</option>
                          {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      ) : (
                        <span className="text-fuchsia-800 ml-2">{adminUser?.state_name || 'Assigned State'}</span>
                      )}
                    </h2>
                  </div>"""
code = code.replace(header_old, header_new)

# Add State Select to Add Admin
add_admin_old = """                  <div className="w-48">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Role</label>
                    <select
                      value={newAdminRole}
                      onChange={(e) => setNewAdminRole(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="SUPER_ADMIN">Super Admin</option>
                    </select>
                  </div>"""

add_admin_new = add_admin_old + """
                  {newAdminRole === 'ADMIN' && (
                    <div className="w-48">
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">State</label>
                      <select
                        value={newAdminStateId}
                        onChange={(e) => setNewAdminStateId(e.target.value)}
                        className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="">Select State</option>
                        {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}"""
code = code.replace(add_admin_old, add_admin_new)

# Also show State in the Admins list
admin_list_header_old = """                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>"""
admin_list_header_new = """                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>\n                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">State</th>"""
code = code.replace(admin_list_header_old, admin_list_header_new)

admin_list_cell_old = """                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            admin.role === 'SUPER_ADMIN' ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {admin.role}
                          </span>
                        </td>"""
admin_list_cell_new = admin_list_cell_old + """\n                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {admin.state_name || '-'}
                        </td>"""
code = code.replace(admin_list_cell_old, admin_list_cell_new)


open('src/pages/AdminDashboard.tsx', 'w').write(code)

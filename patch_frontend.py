import re

# 1. Update server/index.js
with open('server/index.js', 'r') as f:
    server_code = f.read()

bad_login = """    let user;
    if (useSupabase) {
      const { data, error } = await supabase.from('admin_users').select('*').eq('username', username).eq('is_active', true).maybeSingle();
      if (error) throw error;
      user = data;
    } else {
      user = store.admin_users.find(u => u.username === username && u.is_active);
    }

    if (!user || hashPassword(password) !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    if (useSupabase) {
      await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name, state_id: user.state_id }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, state_id: user.state_id } });"""

good_login = """    let user;
    let stateName = null;
    if (useSupabase) {
      const { data, error } = await supabase.from('admin_users').select('*, states(name)').eq('username', username).eq('is_active', true).maybeSingle();
      if (error) throw error;
      user = data;
      if (user?.states) stateName = user.states.name;
    } else {
      user = store.admin_users.find(u => u.username === username && u.is_active);
      if (user?.state_id) {
          const s = store.states.find(st => st.id === user.state_id);
          if (s) stateName = s.name;
      }
    }

    if (!user || hashPassword(password) !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    if (useSupabase) {
      await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name, state_id: user.state_id, state_name: stateName }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, state_id: user.state_id, state_name: stateName } });"""

server_code = server_code.replace(bad_login, good_login)

with open('server/index.js', 'w') as f:
    f.write(server_code)


# 2. Update AdminDashboard.tsx
with open('src/pages/AdminDashboard.tsx', 'r') as f:
    dash_code = f.read()

# Fix districtsList mapping to filter by activeStateId
bad_blocks_memo = """  // Filter blocks when district filter changes
  const blocksList = useMemo(() => {
    if (filterDistrictId && filterDistrictId !== 'ALL') {
      return allBlocksList.filter(b => String(b.district_id) === String(filterDistrictId));
    }
    return allBlocksList;
  }, [filterDistrictId, allBlocksList]);"""

good_blocks_memo = """  const activeStateId = adminUser?.role === 'SUPER_ADMIN' ? dashboardStateId : String(adminUser?.state_id || '');

  // Filter districts by active state
  const filteredDistricts = useMemo(() => {
    if (!activeStateId) return allDistrictsList;
    return allDistrictsList.filter(d => String(d.state_id) === activeStateId);
  }, [allDistrictsList, activeStateId]);

  // Filter blocks by active state
  const filteredBlocks = useMemo(() => {
    if (!activeStateId) return masterBlocks;
    return masterBlocks.filter(b => {
      const d = allDistrictsList.find(dist => dist.id === b.district_id);
      return d && String(d.state_id) === activeStateId;
    });
  }, [masterBlocks, allDistrictsList, activeStateId]);

  // Filter blocks when district filter changes
  const blocksList = useMemo(() => {
    if (filterDistrictId && filterDistrictId !== 'ALL') {
      return filteredBlocks.filter(b => String(b.district_id) === String(filterDistrictId));
    }
    return filteredBlocks;
  }, [filterDistrictId, filteredBlocks]);"""
dash_code = dash_code.replace(bad_blocks_memo, good_blocks_memo)

# Replace all occurrences of districtsList with filteredDistricts in the dropdowns (and masterBlocks with filteredBlocks)
# But wait, districtsList was the state variable initialized on mount!
# In the original code, districtsList is a state variable. I should rename its usage.
dash_code = dash_code.replace('districtsList={districtsList}', 'districtsList={filteredDistricts}')
dash_code = dash_code.replace('options={districtsList.map', 'options={filteredDistricts.map')
dash_code = dash_code.replace('name: districtsList.find', 'name: filteredDistricts.find')
dash_code = dash_code.replace('id === districtsList.find', 'id === filteredDistricts.find')

dash_code = dash_code.replace('options={masterBlocks.map', 'options={filteredBlocks.map')
dash_code = dash_code.replace('name: masterBlocks.find', 'name: filteredBlocks.find')

# Fix state fallback lookup for the title (to fix stale token sessions)
bad_title_lookup = """(adminUser?.state_name || 'India')"""
good_title_lookup = """(adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'India')"""
dash_code = dash_code.replace(bad_title_lookup, good_title_lookup)

bad_header_lookup = """(adminUser?.state_name || 'Assigned State')"""
good_header_lookup = """(adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'Assigned State')"""
dash_code = dash_code.replace(bad_header_lookup, good_header_lookup)

bad_footer_lookup = """(adminUser?.state_name || 'State')"""
good_footer_lookup = """(adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '') || 'State')"""
dash_code = dash_code.replace(bad_footer_lookup, good_footer_lookup)

bad_reports_state_lookup = """adminUser?.state_name ? [{ id: String(adminUser?.state_id), name: adminUser.state_name }] : []"""
good_reports_state_lookup = """(adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '')) ? [{ id: String(adminUser?.state_id), name: (adminUser?.state_name || statesList.find(s => String(s.id) === String(adminUser?.state_id))?.name || '') }] : []"""
dash_code = dash_code.replace(bad_reports_state_lookup, good_reports_state_lookup)

bad_reports_state_val_lookup = """adminUser?.state_name ? { id: String(adminUser?.state_id), name: adminUser.state_name } : null"""
good_reports_state_val_lookup = """(adminUser?.state_name || (adminUser?.state_id ? statesList.find(s => String(s.id) === String(adminUser.state_id))?.name : '')) ? { id: String(adminUser?.state_id), name: (adminUser?.state_name || statesList.find(s => String(s.id) === String(adminUser?.state_id))?.name || '') } : null"""
dash_code = dash_code.replace(bad_reports_state_val_lookup, good_reports_state_val_lookup)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(dash_code)

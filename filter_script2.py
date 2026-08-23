import re

code = open('server/index.js').read()

# REPORTS GENERATE
rg_old = """    let query = supabase.from('daily_reports')
      .select('*, blocks!inner(name, lgd_code, districts!inner(name, id))')
      .order('reporting_date', { ascending: false })
      .limit(Number(limit));"""

rg_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let query = supabase.from('daily_reports')
      .select(targetStateId ? '*, blocks!inner(name, lgd_code, districts!inner(name, id, state_id))' : '*, blocks!inner(name, lgd_code, districts!inner(name, id))')
      .order('reporting_date', { ascending: false })
      .limit(Number(limit));
    if (targetStateId) query = query.eq('blocks.districts.state_id', targetStateId);"""

code = code.replace(rg_old, rg_new)

# ADMIN BLOCKS
ab_old = """    let query = supabase.from('blocks')
      .select('*, districts!inner(name, lgd_code), block_reporting_profiles(base_population, initial_hpv_target)')
      .eq('is_active', true)
      .order('name');"""

ab_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let query = supabase.from('blocks')
      .select(targetStateId ? '*, districts!inner(name, lgd_code, state_id), block_reporting_profiles(base_population, initial_hpv_target)' : '*, districts!inner(name, lgd_code), block_reporting_profiles(base_population, initial_hpv_target)')
      .eq('is_active', true)
      .order('name');
    if (targetStateId) query = query.eq('districts.state_id', targetStateId);"""

code = code.replace(ab_old, ab_new)

# REPORT DOWNLOAD
rd_old = """    let query = supabase.from('daily_reports')
      .select('*, blocks!inner(name, is_urban, code, districts(name, lgd_code, divisions(name)))')
      .order('reporting_date', { ascending: false });"""

rd_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let query = supabase.from('daily_reports')
      .select(targetStateId ? '*, blocks!inner(name, is_urban, code, districts!inner(name, lgd_code, state_id, divisions(name)))' : '*, blocks!inner(name, is_urban, code, districts(name, lgd_code, divisions(name)))')
      .order('reporting_date', { ascending: false });
    if (targetStateId) query = query.eq('blocks.districts.state_id', targetStateId);"""

code = code.replace(rd_old, rd_new)

open('server/index.js', 'w').write(code)

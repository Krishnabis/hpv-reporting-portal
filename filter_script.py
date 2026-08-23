import re

code = open('server/index.js').read()

# DASHBOARD
dash_old = """    if (useSupabase) {
      const [{ count: tb }, { count: rr }, { count: tr }] = await Promise.all([
        supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('daily_reports').select('block_id', { count: 'exact', head: true }).eq('reporting_date', todayStr),
        supabase.from('daily_reports').select('*', { count: 'exact', head: true })
      ]);
      totalBlocks = tb || 0;
      reportedToday = rr || 0;
      totalReports = tr || 0;"""

dash_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    if (useSupabase) {
      let bq = supabase.from('blocks').select(targetStateId ? 'id, districts!inner(state_id)' : 'id').eq('is_active', true);
      if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
      const { data: vBlocks } = await bq;
      const vIds = (vBlocks || []).map(b => b.id);
      
      if (vIds.length === 0) {
        totalBlocks = 0; reportedToday = 0; totalReports = 0;
      } else {
        const [{ count: rr }, { count: tr }] = await Promise.all([
          supabase.from('daily_reports').select('block_id', { count: 'exact', head: true }).eq('reporting_date', todayStr).in('block_id', vIds),
          supabase.from('daily_reports').select('id', { count: 'exact', head: true }).in('block_id', vIds)
        ]);
        totalBlocks = vIds.length;
        reportedToday = rr || 0;
        totalReports = tr || 0;
      }"""
code = code.replace(dash_old, dash_new)


# KPIS
kpi_old = """    // 1. Fetch all active blocks with district info
    const { data: blocks, error: bErr } = await supabase
      .from('blocks')
      .select('id, district_id, districts!inner(name)')
      .eq('is_active', true);"""

kpi_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    // 1. Fetch all active blocks with district info
    let bq = supabase
      .from('blocks')
      .select(targetStateId ? 'id, district_id, districts!inner(name, state_id)' : 'id, district_id, districts!inner(name)')
      .eq('is_active', true);
    if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
    
    const { data: blocks, error: bErr } = await bq;"""
code = code.replace(kpi_old, kpi_new)

# POPULATION
pop_old = """    const { data: blocks, error: bErr } = await supabase
      .from('blocks')
      .select('id, name, district_id, districts(name, lgd_code, divisions(name, states(name)))')
      .eq('is_active', true);"""

pop_new = """    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let bq = supabase
      .from('blocks')
      .select(targetStateId ? 'id, name, district_id, districts!inner(name, lgd_code, state_id, divisions(name, states(name)))' : 'id, name, district_id, districts(name, lgd_code, divisions(name, states(name)))')
      .eq('is_active', true);
    if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
    
    const { data: blocks, error: bErr } = await bq;"""
code = code.replace(pop_old, pop_new)


open('server/index.js', 'w').write(code)

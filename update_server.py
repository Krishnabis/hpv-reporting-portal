import re

with open('server/index.js', 'r') as f:
    code = f.read()

# Helper to inject state filter parsing at the top of a route
state_filter_code = """
    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
"""

# Update /api/admin/dashboard
# Currently: const [{ count: tb }, { count: rr }, { count: tr }] = await Promise.all([
code = re.sub(
    r"(app\.get\('/api/admin/dashboard', authenticateToken, async \(req, res\) => \{\n  try \{\n    const todayStr = new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\];)",
    r"\1\n" + state_filter_code,
    code
)

# Update Supabase queries in dashboard
code = code.replace(
    "supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('is_active', true),",
    """supabase.from('blocks').select(targetStateId ? '*, districts!inner(state_id)' : '*', { count: 'exact', head: true }).eq('is_active', true)"""
)
code = code.replace(
    ".eq('is_active', true)",
    ".eq('is_active', true).match(targetStateId ? { 'districts.state_id': targetStateId } : {})"
)

# Wait, replacing `.eq('is_active', true)` will affect many things!

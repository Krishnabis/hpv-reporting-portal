import re

with open('server/index.js', 'r') as f:
    code = f.read()

# 1. Update Supabase selects
code = code.replace(
    'divisions(name, lgd_code, states(',
    'divisions(name, system_code, states('
)

# 2. Update flattenBlock
code = code.replace(
    'division_lgd_code: div.lgd_code ?? \'\',',
    'division_system_code: div.system_code ?? \'\', // Renamed from lgd_code for divisions'
)

# 3. Update CSV seeding logic
code = code.replace(
    'let division = allDivisions.find(r => r.lgd_code === divisionCode && divisionCode)',
    'let division = allDivisions.find(r => r.system_code === divisionCode && divisionCode)'
)
code = code.replace(
    'await supabase.from(\'divisions\').insert({ state_id: state.id, lgd_code: divisionCode, code: divisionCode, name: row.divisionname?.trim() || \'Default Division\' }).select().single();',
    'await supabase.from(\'divisions\').insert({ state_id: state.id, system_code: divisionCode, code: divisionCode, name: row.divisionname?.trim() || \'Default Division\' }).select().single();'
)

with open('server/index.js', 'w') as f:
    f.write(code)


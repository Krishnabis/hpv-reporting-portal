import re

with open('server/index.js', 'r') as f:
    content = f.read()

# 1. Update the POST /api/admin/users
# Extract facility_id from req.body
content = re.sub(
    r"const \{ username, name, password, role, state_id, district_id \} = req\.body;",
    "const { username, name, password, role, state_id, district_id, facility_id } = req.body;",
    content
)

# Insert facility_id
content = re.sub(
    r"id: newId, username, name, password_hash: passwordHash, role, is_active: true, state_id: state_id \? Number\(state_id\) : null, district_id: district_id \? Number\(district_id\) : null",
    "id: newId, username, name, password_hash: passwordHash, role, is_active: true, state_id: state_id ? Number(state_id) : null, district_id: district_id ? Number(district_id) : null, facility_id: facility_id ? Number(facility_id) : null",
    content
)

# 2. Update GET /api/admin/users
content = re.sub(
    r"\.select\('id, username, name, role, is_active, created_at, last_login_at, state_id, states\(name\), district_id, districts\(name\)'\)",
    ".select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name), district_id, districts(name), facility_id')",
    content
)

with open('server/index.js', 'w') as f:
    f.write(content)


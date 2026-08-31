import re

with open('server/index.js', 'r') as f:
    content = f.read()

# Update the POST /api/admin/users
# Extract ccl_id from req.body instead of facility_id
content = content.replace("district_id, facility_id } = req.body;", "district_id, ccl_id } = req.body;")

# Update the insert statement
content = content.replace("facility_id: facility_id ? Number(facility_id) : null", "ccl_id: ccl_id || null")

# Update the select queries to fetch ccl_id
content = content.replace("districts(name), facility_id')", "districts(name), ccl_id')")

with open('server/index.js', 'w') as f:
    f.write(content)


import re

with open('src/pages/AdminDashboard.tsx', 'r') as f:
    content = f.read()

# Replace facility_id state and usages with ccl_id
content = content.replace('newAdminFacilityId', 'newAdminCclId')
content = content.replace('setNewAdminFacilityId', 'setNewAdminCclId')
content = content.replace('facility_id: newAdminCclId', 'ccl_id: newAdminCclId')

# Update the option value and label
old_option = r"<option key=\{c\.id\} value=\{c\.id\}>\{c\.facility_name\} \{c\.districts\?\.name \? '- ' \+ c\.districts\.name : ''\}</option>"
new_option = "<option key={c.ccl_id} value={c.ccl_id}>{c.facility_name} {c.districts?.name ? '- ' + c.districts.name : ''}</option>"
content = re.sub(old_option, new_option, content)

with open('src/pages/AdminDashboard.tsx', 'w') as f:
    f.write(content)


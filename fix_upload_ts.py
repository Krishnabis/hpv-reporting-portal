import re

with open('src/components/SuperAdminUpload.tsx', 'r') as f:
    content = f.read()

content = re.sub(r'const downloadTemplate = \(type: \'population\' \| \'livedata\'\) => \{', 'const downloadTemplate = (type: \'population\' | \'livedata\' | \'locations\') => {', content)

with open('src/components/SuperAdminUpload.tsx', 'w') as f:
    f.write(content)


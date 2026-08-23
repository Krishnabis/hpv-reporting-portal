import re

with open('server/index.js', 'r') as f:
    content = f.read()

# 1. Update /api/admin/reports/generate query parsing
query_replace = """    const { date, districtId, blockId, divisionId, level = 'BLOCK' } = req.query;"""
content = re.sub(r'const { date, districtId, blockId, level = \'BLOCK\' } = req\.query;', query_replace, content)

bquery_filter = """    if (districtId && districtId !== 'ALL') bQuery = bQuery.eq('district_id', districtId);
    if (divisionId && divisionId !== 'ALL') bQuery = bQuery.eq('districts.division_id', divisionId);
    if (blockId && blockId !== 'ALL') bQuery = bQuery.eq('id', blockId);"""
content = re.sub(r'if \(districtId && districtId !== \'ALL\'\) bQuery = bQuery\.eq\(\'district_id\', districtId\);\s*if \(blockId && blockId !== \'ALL\'\) bQuery = bQuery\.eq\(\'id\', blockId\);', bquery_filter, content)

# 2. Add DIVISION grouping in reports
division_grouping = """    } else if (level === 'DIVISION') {
      const divGroup = {};
      blockData.forEach(b => {
        const divId = b.districts?.division_id || 'unknown';
        const divName = b.districts?.divisions?.name || 'Unknown';
        if (!divGroup[divId]) {
          divGroup[divId] = {
            id: divId,
            name: `${divName} Division`,
            lgd_code: '-',
            population: 0,
            hpv_target: 0,
            line_list_received: 0,
            beneficiaries_vaccinated: 0,
            last_reporting_date: '—',
            has_report: false
          };
        }
        const g = divGroup[divId];
        g.population += b.population;
        g.hpv_target += b.hpv_target;
        if (b.has_report) {
          g.line_list_received += b.line_list_received;
          g.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          g.has_report = true;
          g.last_reporting_date = reportDate;
        }
      });
      finalRows = Object.values(divGroup);
    } else if (level === 'STATE') {"""
content = re.sub(r'\} else if \(level === \'STATE\'\) \{', division_grouping, content)


# 3. Update /api/admin/trend
trend_replace1 = """    const { level = 'STATE', districtId, blockId, divisionId } = req.query;"""
content = re.sub(r'const { level = \'STATE\', districtId, blockId } = req\.query;', trend_replace1, content)

trend_replace2 = """    // 1. Fetch blocks
    let bQuery = supabase.from('blocks').select('id, name, district_id, districts!inner(division_id)').eq('is_active', true);
    if (level === 'DIVISION' && divisionId && divisionId !== 'ALL') {
      bQuery = bQuery.eq('districts.division_id', divisionId);
    } else if (level === 'DISTRICT' && districtId && districtId !== 'ALL') {
      bQuery = bQuery.eq('district_id', districtId);
    } else if (level === 'BLOCK' && blockId && blockId !== 'ALL') {"""

content = re.sub(r'// 1\. Fetch blocks\n    let bQuery = supabase\.from\(\'blocks\'\)\.select\(\'id, name\'\)\.eq\(\'is_active\', true\);\n    if \(level === \'DISTRICT\' && districtId && districtId !== \'ALL\'\) \{\n      bQuery = bQuery\.eq\(\'district_id\', districtId\);\n    \} else if \(level === \'BLOCK\' && blockId && blockId !== \'ALL\'\) \{', trend_replace2, content)


with open('server/index.js', 'w') as f:
    f.write(content)


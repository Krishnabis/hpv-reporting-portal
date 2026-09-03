export interface DefaultLocationResult {
  stateId: string;
  districtId: string;
  isDistrictUser: boolean;
  defaultLevel: 'District' | 'Block Units' | 'Block';
  ukState: any | null;
  userDistrict: any | null;
}

export function getDefaultLocationForUser(
  adminUser: any,
  statesList: any[] = [],
  districtsList: any[] = []
): DefaultLocationResult {
  const ukState = statesList.find((s: any) => 
    s.name === 'Uttarakhand State' || 
    s.name === 'Uttarakhand' || 
    (s.name && s.name.toLowerCase().includes('uttarakhand'))
  );
  const ukStateId = ukState ? String(ukState.id) : (adminUser?.state_id ? String(adminUser.state_id) : '5');

  const role = (adminUser?.role || '').toUpperCase();
  const cclLevel = String(adminUser?.ccl_unit_level || '');
  const hasDistrict = Boolean(adminUser?.district_id || adminUser?.district_name);

  // Group 1: Super admin, State admin, Regional/divisional store admin, State store admin
  // Group 2: District vaccine store, District admin
  const isDistrictRole = 
    role === 'DISTRICT_ADMIN' || 
    role === 'DISTRICT_STORE_ADMIN' || 
    role === 'DISTRICT_VACCINE_STORE' || 
    (role === 'VACCINE_MANAGER' && cclLevel === '2') ||
    (hasDistrict && !['SUPER_ADMIN', 'STATE_ADMIN', 'DIVISIONAL_ADMIN', 'REGIONAL_ADMIN', 'DIVISION_ADMIN', 'STATE_STORE_ADMIN', 'STATE_VACCINE_STORE'].includes(role));

  if (isDistrictRole) {
    let userDistrict: any = null;
    let targetDistrictId = 'ALL';

    if (adminUser?.district_id) {
      targetDistrictId = String(adminUser.district_id);
      userDistrict = districtsList.find((d: any) => String(d.id) === targetDistrictId) || null;
    }
    
    if (!userDistrict && adminUser?.district_name && districtsList.length > 0) {
      const match = districtsList.find((d: any) => 
        d.name && d.name.toLowerCase().trim() === adminUser.district_name.toLowerCase().trim()
      );
      if (match) {
        userDistrict = match;
        targetDistrictId = String(match.id);
      }
    }

    return {
      stateId: ukStateId,
      districtId: targetDistrictId,
      isDistrictUser: true,
      defaultLevel: 'Block Units',
      ukState: ukState || null,
      userDistrict
    };
  }

  // State / Regional / State Store roles -> Default to Uttarakhand
  return {
    stateId: ukStateId,
    districtId: 'ALL',
    isDistrictUser: false,
    defaultLevel: 'District',
    ukState: ukState || null,
    userDistrict: null
  };
}

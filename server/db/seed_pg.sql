-- =============================================================
-- PostgreSQL Complete Seed Script for Supabase / Railway
-- HPV Vaccination Reporting Portal
-- =============================================================

-- 1. Seed States
INSERT INTO states (id, lgd_code, name, code) VALUES
(1, 5, 'Uttarakhand', 'UK')
ON CONFLICT (lgd_code) DO NOTHING;

-- 2. Seed Districts
INSERT INTO districts (state_id, lgd_code, name, code) VALUES
(1, 45, 'Almora', 'ALM'),
(1, 46, 'Bageshwar', 'BAG'),
(1, 47, 'Chamoli', 'CHA'),
(1, 48, 'Champawat', 'CHA'),
(1, 49, 'Dehradun', 'DEH'),
(1, 50, 'Haridwar', 'HAR'),
(1, 51, 'Nainital', 'NAI'),
(1, 52, 'Pauri Garhwal', 'PAU'),
(1, 53, 'Pithoragarh', 'PIT'),
(1, 54, 'Rudraprayag', 'RUD'),
(1, 55, 'Tehri Garhwal', 'TEH'),
(1, 56, 'Udham Singh Nagar', 'UDH'),
(1, 57, 'Uttarkashi', 'UTT')
ON CONFLICT (lgd_code) DO NOTHING;

-- 3. Seed Blocks (95 Blocks with LGD Codes)
INSERT INTO blocks (district_id, lgd_code, name, code) VALUES
((SELECT id FROM districts WHERE lgd_code = 45), 352, 'Bhaisiya Chhana', 'BHA'),
((SELECT id FROM districts WHERE lgd_code = 45), 353, 'Bhikiyasain', 'BHI'),
((SELECT id FROM districts WHERE lgd_code = 45), 354, 'Chaukhutiya', 'CHA'),
((SELECT id FROM districts WHERE lgd_code = 45), 355, 'Dhauladevi', 'DHA'),
((SELECT id FROM districts WHERE lgd_code = 45), 356, 'Dwarahat', 'DWA'),
((SELECT id FROM districts WHERE lgd_code = 45), 357, 'Hawalbag', 'HAW'),
((SELECT id FROM districts WHERE lgd_code = 45), 358, 'Lamgara', 'LAM'),
((SELECT id FROM districts WHERE lgd_code = 45), 359, 'Sult', 'SUL'),
((SELECT id FROM districts WHERE lgd_code = 45), 360, 'Syaldey', 'SYA'),
((SELECT id FROM districts WHERE lgd_code = 45), 361, 'Takula', 'TAK'),
((SELECT id FROM districts WHERE lgd_code = 45), 362, 'Tarikhet', 'TAR'),
((SELECT id FROM districts WHERE lgd_code = 46), 363, 'Bageshwar', 'BAG'),
((SELECT id FROM districts WHERE lgd_code = 46), 364, 'Garur', 'GAR'),
((SELECT id FROM districts WHERE lgd_code = 46), 365, 'Kapkote', 'KAP'),
((SELECT id FROM districts WHERE lgd_code = 47), 366, 'Dasholi', 'DAS'),
((SELECT id FROM districts WHERE lgd_code = 47), 367, 'Dewal', 'DEW'),
((SELECT id FROM districts WHERE lgd_code = 47), 368, 'Gairsain', 'GAI'),
((SELECT id FROM districts WHERE lgd_code = 47), 369, 'Ghat', 'GHA'),
((SELECT id FROM districts WHERE lgd_code = 47), 370, 'Joshimath', 'JOS'),
((SELECT id FROM districts WHERE lgd_code = 47), 371, 'Karnaprayag', 'KAR'),
((SELECT id FROM districts WHERE lgd_code = 47), 372, 'Narayanbagar', 'NAR'),
((SELECT id FROM districts WHERE lgd_code = 47), 373, 'Pokhari', 'POK'),
((SELECT id FROM districts WHERE lgd_code = 47), 374, 'Tharali', 'THA'),
((SELECT id FROM districts WHERE lgd_code = 48), 375, 'Barakot', 'BAR'),
((SELECT id FROM districts WHERE lgd_code = 48), 376, 'Champawat', 'CHA'),
((SELECT id FROM districts WHERE lgd_code = 48), 377, 'Lohaghat', 'LOH'),
((SELECT id FROM districts WHERE lgd_code = 48), 378, 'Pati', 'PAT'),
((SELECT id FROM districts WHERE lgd_code = 49), 379, 'Chakrata', 'CHA'),
((SELECT id FROM districts WHERE lgd_code = 49), 380, 'Doiwala', 'DOI'),
((SELECT id FROM districts WHERE lgd_code = 49), 381, 'Kalsi', 'KAL'),
((SELECT id FROM districts WHERE lgd_code = 49), 382, 'Raipur', 'RAI'),
((SELECT id FROM districts WHERE lgd_code = 49), 383, 'Sahaspur', 'SAH'),
((SELECT id FROM districts WHERE lgd_code = 49), 384, 'Vikasnagar', 'VIK'),
((SELECT id FROM districts WHERE lgd_code = 50), 385, 'Bahadrabad', 'BAH'),
((SELECT id FROM districts WHERE lgd_code = 50), 386, 'Bhagwanpur', 'BHA'),
((SELECT id FROM districts WHERE lgd_code = 50), 387, 'Khanpur', 'KHA'),
((SELECT id FROM districts WHERE lgd_code = 50), 388, 'Laksar', 'LAK'),
((SELECT id FROM districts WHERE lgd_code = 50), 389, 'Narsan', 'NAR'),
((SELECT id FROM districts WHERE lgd_code = 50), 390, 'Roorkee', 'ROO'),
((SELECT id FROM districts WHERE lgd_code = 51), 391, 'Betalghat', 'BET'),
((SELECT id FROM districts WHERE lgd_code = 51), 392, 'Bhimtal', 'BHI'),
((SELECT id FROM districts WHERE lgd_code = 51), 393, 'Dhari', 'DHA'),
((SELECT id FROM districts WHERE lgd_code = 51), 394, 'Haldwani', 'HAL'),
((SELECT id FROM districts WHERE lgd_code = 51), 395, 'Kotabag', 'KOT'),
((SELECT id FROM districts WHERE lgd_code = 51), 396, 'Okhalkanda', 'OKH'),
((SELECT id FROM districts WHERE lgd_code = 51), 397, 'Ramgarh', 'RAM'),
((SELECT id FROM districts WHERE lgd_code = 51), 398, 'Ramnagar', 'RAM'),
((SELECT id FROM districts WHERE lgd_code = 52), 399, 'Bironkhal', 'BIR'),
((SELECT id FROM districts WHERE lgd_code = 52), 400, 'Duggada', 'DUG'),
((SELECT id FROM districts WHERE lgd_code = 52), 401, 'Dwarikhal', 'DWA'),
((SELECT id FROM districts WHERE lgd_code = 52), 402, 'Ekeshwar', 'EKE'),
((SELECT id FROM districts WHERE lgd_code = 52), 403, 'Kaljikhal', 'KAL'),
((SELECT id FROM districts WHERE lgd_code = 52), 404, 'Khirsu', 'KHI'),
((SELECT id FROM districts WHERE lgd_code = 52), 405, 'Kot', 'KOT'),
((SELECT id FROM districts WHERE lgd_code = 52), 406, 'Nainidanda', 'NAI'),
((SELECT id FROM districts WHERE lgd_code = 52), 407, 'Pabau', 'PAB'),
((SELECT id FROM districts WHERE lgd_code = 52), 408, 'Pauri', 'PAU'),
((SELECT id FROM districts WHERE lgd_code = 52), 409, 'Pokhra', 'POK'),
((SELECT id FROM districts WHERE lgd_code = 52), 410, 'Rikhnikhal', 'RIK'),
((SELECT id FROM districts WHERE lgd_code = 52), 411, 'Thalisain', 'THA'),
((SELECT id FROM districts WHERE lgd_code = 52), 412, 'Yamkeshwar', 'YAM'),
((SELECT id FROM districts WHERE lgd_code = 52), 413, 'Zahrikhal', 'ZAH'),
((SELECT id FROM districts WHERE lgd_code = 53), 414, 'Berinag', 'BER'),
((SELECT id FROM districts WHERE lgd_code = 53), 415, 'Dharchula', 'DHA'),
((SELECT id FROM districts WHERE lgd_code = 53), 416, 'Didihat', 'DID'),
((SELECT id FROM districts WHERE lgd_code = 53), 417, 'Gangolihat', 'GAN'),
((SELECT id FROM districts WHERE lgd_code = 53), 418, 'Kanalichina', 'KAN'),
((SELECT id FROM districts WHERE lgd_code = 53), 419, 'Munakot', 'MUN'),
((SELECT id FROM districts WHERE lgd_code = 53), 420, 'Munsyari', 'MUN'),
((SELECT id FROM districts WHERE lgd_code = 53), 421, 'Pithoragarh', 'PIT'),
((SELECT id FROM districts WHERE lgd_code = 54), 422, 'Augustmuni', 'AUG'),
((SELECT id FROM districts WHERE lgd_code = 54), 423, 'Jakholi', 'JAK'),
((SELECT id FROM districts WHERE lgd_code = 54), 424, 'Ukhimath', 'UKH'),
((SELECT id FROM districts WHERE lgd_code = 55), 425, 'Bhilangna', 'BHI'),
((SELECT id FROM districts WHERE lgd_code = 55), 426, 'Chamba', 'CHA'),
((SELECT id FROM districts WHERE lgd_code = 55), 427, 'Deoprayag', 'DEO'),
((SELECT id FROM districts WHERE lgd_code = 55), 428, 'Jakhnidhar', 'JAK'),
((SELECT id FROM districts WHERE lgd_code = 55), 429, 'Jaunpur', 'JAU'),
((SELECT id FROM districts WHERE lgd_code = 55), 430, 'Kirtinagar', 'KIR'),
((SELECT id FROM districts WHERE lgd_code = 55), 431, 'Narendra Nagar', 'NAR'),
((SELECT id FROM districts WHERE lgd_code = 55), 432, 'Pratapnagar', 'PRA'),
((SELECT id FROM districts WHERE lgd_code = 55), 433, 'Thauldhar', 'THA'),
((SELECT id FROM districts WHERE lgd_code = 56), 434, 'Bajpur', 'BAJ'),
((SELECT id FROM districts WHERE lgd_code = 56), 435, 'Gadarpur', 'GAD'),
((SELECT id FROM districts WHERE lgd_code = 56), 436, 'Jaspur', 'JAS'),
((SELECT id FROM districts WHERE lgd_code = 56), 437, 'Kashipur', 'KAS'),
((SELECT id FROM districts WHERE lgd_code = 56), 438, 'Khatima', 'KHA'),
((SELECT id FROM districts WHERE lgd_code = 56), 439, 'Rudrapur', 'RUD'),
((SELECT id FROM districts WHERE lgd_code = 56), 440, 'Sitarganj', 'SIT'),
((SELECT id FROM districts WHERE lgd_code = 57), 441, 'Bhatwari', 'BHA'),
((SELECT id FROM districts WHERE lgd_code = 57), 442, 'Chinyalisaur', 'CHI'),
((SELECT id FROM districts WHERE lgd_code = 57), 443, 'Dunda', 'DUN'),
((SELECT id FROM districts WHERE lgd_code = 57), 444, 'Mori', 'MOR'),
((SELECT id FROM districts WHERE lgd_code = 57), 445, 'Naugaon', 'NAU'),
((SELECT id FROM districts WHERE lgd_code = 57), 446, 'Purola', 'PUR')
ON CONFLICT (lgd_code) DO NOTHING;

-- 4. Seed Program Settings
INSERT INTO settings (id, key, value, description) VALUES
('set-1', 'monthly_population_growth', '0.0008', 'Monthly population growth rate (0.08% per month)'),
('set-2', 'hpv_target_percentage', '0.01', 'Target HPV beneficiary percentage of total population (1.00%)'),
('set-3', 'reporting_enabled', 'true', 'Global flag to enable block reporting'),
('set-4', 'allow_previous_date_entry', 'true', 'Allow reporting for historical dates'),
('set-5', 'organization_name', 'HPV KAVACH', 'System organization name'),
('set-6', 'portal_title', 'HPV KAVACH', 'Header display title'),
('set-7', 'default_state', 'Uttarakhand', 'Default state selected in reports')
ON CONFLICT (key) DO NOTHING;

-- 5. Seed Admin User (UKHPV2026 / UKHPV2026)
INSERT INTO admin_users (id, username, password_hash, name, role) VALUES
('usr-admin-1', 'UKHPV2026', '$2a$10$92ngWQHaD2s58LXkD8/Z1ePpOG.podGSAqSqgSY8.VBfqAAEN3nBu', 'State HPV Administrator', 'SUPER_ADMIN')
ON CONFLICT (username) DO NOTHING;


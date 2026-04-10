-- =============================================================================
--  PYRAMID ENGINEERING — Seed Data
--  Run AFTER schema.sql
-- =============================================================================

-- Blog categories
INSERT INTO blog_categories (name, slug) VALUES
  ('Construction Tips',  'construction-tips'),
  ('Architecture',       'architecture'),
  ('Materials',          'materials'),
  ('Project Updates',    'project-updates'),
  ('Company News',       'company-news')
ON CONFLICT (slug) DO NOTHING;

-- Services
INSERT INTO services (title, slug, short_desc, full_desc, audience, status, sort_order, features) VALUES
  ('Building Construction',
   'building-construction',
   'Full-scale residential, commercial, and industrial building construction.',
   'We deliver end-to-end building construction services for homes, offices, factories, and government facilities. Our certified engineers ensure structural integrity, code compliance, and on-time delivery.',
   'all', 'published', 1,
   '["Licensed Engineers","Structural Design","Quality Materials","On-Time Delivery","Post-Construction Support"]'),
  ('Architecture & Planning',
   'architecture-planning',
   'Custom architectural design and detailed planning for all project types.',
   'From initial concept to permit-ready drawings, our architects create functional, beautiful spaces. We handle 2D floor plans, 3D renders, BOQ, and permit applications.',
   'all', 'published', 2,
   '["Concept Design","2D Floor Plans","3D Rendering","BOQ Preparation","Permit Applications"]'),
  ('Consultation & Feasibility',
   'consultation-feasibility',
   'Expert guidance on project viability, budgeting, and regulatory requirements.',
   'Before you break ground, make sure your project is viable. We conduct site surveys, feasibility studies, environmental assessments, and budget planning.',
   'all', 'published', 3,
   '["Site Survey","Feasibility Study","Budget Planning","Risk Assessment","Regulatory Compliance"]'),
  ('Renovation & Maintenance',
   'renovation-maintenance',
   'Professional renovation, retrofitting, and ongoing maintenance services.',
   'Transform old structures into modern, functional spaces. We handle interior remodelling, structural upgrades, painting, electrical, plumbing, and preventive maintenance programs.',
   'all', 'published', 4,
   '["Interior Remodelling","Structural Upgrades","Electrical & Plumbing","Painting & Finishing","Maintenance Programs"]')
ON CONFLICT (slug) DO NOTHING;

-- Global settings
INSERT INTO settings (key, value, setting_type, group_name, label, is_public) VALUES
  ('site_name',       'Pyramid Engineering & Construction LTD', 'text', 'general',    'Site Name',           true),
  ('site_tagline',    'Building the Future, Trusted & Reliable','text', 'general',    'Site Tagline',        true),
  ('phone_primary',   '+255 757 744 555',                        'text', 'contact',    'Primary Phone',       true),
  ('phone_secondary', '+255 757 744 555',                        'text', 'contact',    'Secondary Phone',     true),
  ('email_primary',   'pyramid.constructor.ltd@gmail.com',       'text', 'contact',    'Primary Email',       true),
  ('address',         'Dar es Salaam, Tanzania',                 'text', 'contact',    'Address',             true),
  ('whatsapp_number', '255757744555',                            'text', 'contact',    'WhatsApp Number',     true),
  ('hero_video_url',  '',                                        'text', 'appearance', 'Hero Background Video URL', true),
  ('facebook_url',    '#',                                       'text', 'social',     'Facebook URL',        true),
  ('linkedin_url',    '#',                                       'text', 'social',     'LinkedIn URL',        true),
  ('instagram_url',   '#',                                       'text', 'social',     'Instagram URL',       true),
  ('tiktok_url',      '#',                                       'text', 'social',     'TikTok URL',          true),
  ('years_experience','15',                                      'text', 'stats',      'Years of Experience', true),
  ('projects_completed','300',                                   'text', 'stats',      'Projects Completed',  true),
  ('client_satisfaction','98',                                   'text', 'stats',      'Client Satisfaction %',true),
  ('team_members',    '50',                                      'text', 'stats',      'Team Members',        true)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Sample testimonials
INSERT INTO testimonials (client_name, client_role, client_type, body, rating, is_featured, sort_order, status) VALUES
  ('John Mwangi', 'Homeowner, Dar es Salaam', 'individual',
   'Pyramid Engineering built my family home exactly as planned. Their team was professional, punctual, and the quality of work exceeded my expectations. I highly recommend them.',
   5, true, 1, 'published'),
  ('Sarah Kimani', 'CEO, TanzTech Solutions', 'company',
   'We hired Pyramid for our new office complex. They delivered on time and within budget. The architectural design was modern and functional. Outstanding service!',
   5, true, 2, 'published'),
  ('Ministry of Works', 'Government Project', 'government',
   'Pyramid Engineering demonstrated exceptional capability in our infrastructure project. Their compliance with government standards and attention to detail was commendable.',
   5, true, 3, 'published')
ON CONFLICT DO NOTHING;

-- Partners
INSERT INTO partners (name, website_url, sort_order, is_visible) VALUES
  ('Tanzania Building Agency',   'https://tba.go.tz',    1, true),
  ('NSSF Tanzania',              'https://nssf.or.tz',   2, true),
  ('Tanzania Revenue Authority', 'https://tra.go.tz',    3, true),
  ('Cement Association',         '#',                     4, true),
  ('Architecture Board',         '#',                     5, true),
  ('Engineers Board Tanzania',   '#',                     6, true)
ON CONFLICT DO NOTHING;

-- Team members
INSERT INTO team_members (name, role_title, bio, sort_order, is_visible) VALUES
  ('Eng. Christian Lema',    'Chief Executive Officer',
   'Founder and CEO with 15+ years of construction and engineering expertise across Tanzania.', 1, true),
  ('Arch. Amina Hassan',     'Lead Architect',
   'Award-winning architect specializing in sustainable, functional commercial and residential designs.', 2, true),
  ('Eng. David Mushi',       'Senior Structural Engineer',
   'Expert in structural analysis and design for high-rise buildings and infrastructure projects.', 3, true),
  ('Ms. Grace Tarimo',       'Project Manager',
   'Certified PMP professional ensuring projects are delivered on time, within scope and budget.', 4, true)
ON CONFLICT DO NOTHING;

SELECT 'Seed data inserted successfully' AS result;

-- Insert regional representatives into executive_committee
-- Source: executive committee spreadsheet (rows 18-35)
-- Skipping 3 vacant positions: Northern (North East), Republic of Ireland, Southwest Thames (London)

INSERT INTO executive_committee (full_name, email, role, region, is_active, sort_order)
VALUES
  ('Jennifer Couch',    'drjhcouch@gmail.com',           'Regional Representative', 'East Midlands',           true, 100),
  ('Cho Ee Ng',         'isao.nce@gmail.com',            'Regional Representative', 'North West (Mersey)',     true, 101),
  ('Theo Pelly',        'theopelly@gmail.com',           'Regional Representative', 'London',                  true, 102),
  ('Khaldoun Nadi',     'khaldounnadi@yahoo.com',        'Regional Representative', 'Wales',                   true, 103),
  ('Emiko Sultana',     'emiko.sultana.8@gmail.com',     'Regional Representative', 'London',                  true, 104),
  ('Bianca Wadham',     'biancawadham@gmail.com',        'Regional Representative', 'North West (North Western)', true, 105),
  ('Rachael Coulson',   'rachael.coulson.rc@gmail.com',  'Regional Representative', 'Northern Ireland',        true, 106),
  ('Nikhil Lal',        'nikhillal1995@gmail.com',       'Regional Representative', 'Thames Valley',           true, 107),
  ('Carly Bisset',      'carly_bisset@hotmail.co.uk',    'Regional Representative', 'Scotland',                true, 108),
  ('Jennifer Watt',     'j.watt1@nhs.net',               'Regional Representative', 'Kent, Surrey and Sussex', true, 109),
  ('Jenny Waterman',    'jwaterman2008@gmail.com',       'Regional Representative', 'Wales',                   true, 110),
  ('Aneesha Verma',     'aneeshaverma1@gmail.com',       'Regional Representative', 'London',                  true, 111),
  ('Easan Anand',       'easan.anand2@nhs.net',          'Regional Representative', 'Wessex',                  true, 112),
  ('Katerina Peleki',   'katerinawaterland@gmail.com',   'Regional Representative', 'West Midlands',           true, 113),
  ('Alexios Dosis',     'alexisdosis@icloud.com',        'Regional Representative', 'Yorkshire and the Humber', true, 114);

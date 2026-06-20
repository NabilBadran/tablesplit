-- ============================================================================
-- TableSplit — Seed data for "Caffè Lumo"
-- Run AFTER schema.sql. Loads 6 tables and a focused 12-item Italian menu.
-- Sessions are NOT seeded — staff create them by adding the first item.
-- ============================================================================

-- 6 tables -------------------------------------------------------------------
insert into tables (name) values
  ('Table 1'),
  ('Table 2'),
  ('Table 3'),
  ('Table 4'),
  ('Table 5'),
  ('Table 6');

-- 12 menu items across starters / mains / desserts / drinks (GBP) ------------
insert into menu_items (name, price, category) values
  -- Starters
  ('Bruschetta al Pomodoro',  7.50,  'starter'),
  ('Burrata & Prosciutto',    12.00, 'starter'),
  ('Calamari Fritti',         10.50, 'starter'),
  -- Mains
  ('Tagliatelle al Ragù',     16.50, 'main'),
  ('Risotto ai Funghi',       15.00, 'main'),
  ('Margherita DOP',          13.50, 'main'),
  ('Branzino alla Griglia',   22.00, 'main'),
  -- Desserts
  ('Tiramisù',                8.50,  'dessert'),
  ('Panna Cotta',             7.50,  'dessert'),
  -- Drinks
  ('Negroni',                 11.00, 'drink'),
  ('Aperol Spritz',           9.50,  'drink'),
  ('Bottle of Chianti',       32.00, 'drink');

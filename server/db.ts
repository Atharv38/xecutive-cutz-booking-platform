import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'xecutive_cutz.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expires TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('customer', 'admin')) DEFAULT 'customer',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
      duration_minutes INTEGER CHECK (duration_minutes IS NULL OR (duration_minutes >= 10 AND duration_minutes <= 360)),
      image_url TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 0,
      is_owner_approved INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Barber',
      bio TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      specialties TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      is_placeholder INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS barber_services (
      barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      PRIMARY KEY (barber_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS barber_schedules (
      id TEXT PRIMARY KEY,
      barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
      is_working INTEGER NOT NULL DEFAULT 1,
      start_time TEXT NOT NULL DEFAULT '08:00',
      end_time TEXT NOT NULL DEFAULT '19:00',
      break_start TEXT,
      break_end TEXT,
      UNIQUE(barber_id, day_of_week)
    );

    CREATE TABLE IF NOT EXISTS business_hours (
      id TEXT PRIMARY KEY,
      day_of_week INTEGER NOT NULL UNIQUE CHECK (day_of_week BETWEEN 0 AND 6),
      is_open INTEGER NOT NULL DEFAULT 0,
      open_time TEXT NOT NULL DEFAULT '08:00',
      close_time TEXT NOT NULL DEFAULT '19:00',
      break_start TEXT,
      break_end TEXT,
      is_owner_confirmed INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS blocked_dates (
      id TEXT PRIMARY KEY,
      barber_id TEXT REFERENCES barbers(id) ON DELETE CASCADE,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      block_type TEXT NOT NULL DEFAULT 'holiday',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blocked_time_slots (
      id TEXT PRIMARY KEY,
      barber_id TEXT REFERENCES barbers(id) ON DELETE CASCADE,
      slot_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('active', 'vip', 'blocked')) DEFAULT 'active',
      profile_type TEXT NOT NULL DEFAULT 'guest',
      email_verified INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      booking_reference TEXT NOT NULL UNIQUE,
      customer_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service_id TEXT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
      barber_id TEXT NOT NULL REFERENCES barbers(id) ON DELETE RESTRICT,
      appointment_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      price_at_booking INTEGER NOT NULL DEFAULT 0,
      service_name_snapshot TEXT NOT NULL,
      duration_minutes_snapshot INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'confirmed',
      customer_notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_lookup ON appointments(appointment_date, barber_id, status);
    CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_ref ON appointments(booking_reference);

    CREATE TABLE IF NOT EXISTS gallery_images (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('Haircuts', 'Skin Fades', 'Beard Styling', 'At Work', 'Interior')),
      image_url TEXT NOT NULL,
      alt_text TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      author_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'Google Review',
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5) DEFAULT 5,
      quote TEXT NOT NULL,
      is_verified_google INTEGER NOT NULL DEFAULT 0,
      is_approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      cover_image_url TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Grooming Guide',
      is_published INTEGER NOT NULL DEFAULT 1,
      published_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1) DEFAULT 1,
      business_name TEXT NOT NULL DEFAULT 'Xecutive Cutz',
      address TEXT NOT NULL DEFAULT '919 N Haskell Ave., Dallas, TX 75204, United States',
      phone TEXT NOT NULL DEFAULT '+1 972-358-1199',
      email TEXT NOT NULL DEFAULT '',
      logo_url TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT 'Precision Cuts. Executive Style.',
      currency TEXT NOT NULL DEFAULT 'USD',
      timezone TEXT NOT NULL DEFAULT 'America/Chicago',
      google_rating REAL NOT NULL DEFAULT 5.0,
      google_review_count INTEGER NOT NULL DEFAULT 6,
      google_maps_url TEXT NOT NULL DEFAULT 'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/',
      instagram_url TEXT NOT NULL DEFAULT '',
      facebook_url TEXT NOT NULL DEFAULT '',
      tiktok_url TEXT NOT NULL DEFAULT '',
      allow_guest_booking INTEGER NOT NULL DEFAULT 1,
      cancellation_window_hours INTEGER NOT NULL DEFAULT 12,
      max_advance_days INTEGER NOT NULL DEFAULT 60,
      buffer_minutes INTEGER NOT NULL DEFAULT 0,
      require_admin_confirmation INTEGER NOT NULL DEFAULT 0,
      email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_role TEXT NOT NULL CHECK (recipient_role IN ('customer', 'admin')),
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      delivery_status TEXT NOT NULL CHECK (delivery_status IN ('sent', 'pending', 'not_configured', 'failed')) DEFAULT 'not_configured',
      provider TEXT NOT NULL DEFAULT 'resend',
      error_message TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumnMigrations();
  seedInitialData();
}

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function ensureColumnMigrations(): void {
  if (!hasColumn('profiles', 'auth_provider')) {
    db.exec(`ALTER TABLE profiles ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'email'`);
  }
  if (!hasColumn('customers', 'profile_type')) {
    db.exec(`ALTER TABLE customers ADD COLUMN profile_type TEXT NOT NULL DEFAULT 'guest'`);
  }
  if (!hasColumn('customers', 'email_verified')) {
    db.exec(`ALTER TABLE customers ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
  }

  // Link any unlinked customers whose email already exists in profiles and sync verification/type
  db.exec(`
    UPDATE customers
    SET profile_id = COALESCE(profile_id, (SELECT p.id FROM profiles p WHERE LOWER(p.email) = LOWER(customers.email) LIMIT 1)),
        profile_type = CASE
          WHEN EXISTS (SELECT 1 FROM profiles p WHERE LOWER(p.email) = LOWER(customers.email) AND p.auth_provider = 'google') THEN 'google'
          WHEN EXISTS (SELECT 1 FROM profiles p WHERE LOWER(p.email) = LOWER(customers.email)) THEN 'registered'
          WHEN LOWER(email) = 'walkin@xecutivecutz.com' THEN 'walkin'
          ELSE COALESCE(NULLIF(profile_type, ''), 'guest')
        END,
        email_verified = CASE
          WHEN EXISTS (SELECT 1 FROM profiles p WHERE LOWER(p.email) = LOWER(customers.email) AND p.email_verified = 1) THEN 1
          ELSE COALESCE(email_verified, 0)
        END
  `);
}

function seedInitialData(): void {
  // 1. Business Settings
  const settingsExists = db.prepare('SELECT id FROM business_settings WHERE id = 1').get();
  if (!settingsExists) {
    db.prepare(`
      INSERT INTO business_settings (
        id, business_name, address, phone, email, tagline, currency, timezone,
        google_rating, google_review_count, google_maps_url
      ) VALUES (
        1,
        'Xecutive Cutz',
        '919 N Haskell Ave., Dallas, TX 75204, United States',
        '+1 972-358-1199',
        'owner@xecutivecutz.com',
        'Precision Cuts. Executive Style.',
        'USD',
        'America/Chicago',
        5.0,
        6,
        'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/'
      )
    `).run();
  }

  // 2. Business Hours (Tue-Sat 08:00-19:00 listed, Sun/Mon require owner confirmation)
  const hoursCount = (db.prepare('SELECT COUNT(*) as c FROM business_hours').get() as { c: number }).c;
  if (hoursCount === 0) {
    const insertHour = db.prepare(`
      INSERT INTO business_hours (id, day_of_week, is_open, open_time, close_time, break_start, break_end, is_owner_confirmed, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const days = [
      { day: 0, open: 0, note: 'Sunday hours require owner confirmation' },
      { day: 1, open: 0, note: 'Monday hours require owner confirmation' },
      { day: 2, open: 1, note: 'Listed public hours (pending owner confirmation)' },
      { day: 3, open: 1, note: 'Listed public hours (pending owner confirmation)' },
      { day: 4, open: 1, note: 'Listed public hours (pending owner confirmation)' },
      { day: 5, open: 1, note: 'Listed public hours (pending owner confirmation)' },
      { day: 6, open: 1, note: 'Listed public hours (pending owner confirmation)' },
    ];
    for (const d of days) {
      insertHour.run(crypto.randomUUID(), d.day, d.open, '08:00', '19:00', null, null, 0, d.note);
    }
  }

  // 3. Service Menu (Priced, Active, and Editable by Owner in Admin)
  const defaultServices = [
    {
      name: 'Classic Haircut',
      desc: 'Tailored scissor and clipper cut, detailed taper finish, and clean neck shave.',
      priceCents: 3500,
      durationMinutes: 45,
      img: '/assets/local/service_haircut_fade.jpg',
      order: 1,
    },
    {
      name: 'Skin Fade',
      desc: 'Seamless zero-to-length gradient fade with razor-sharp framing and styling.',
      priceCents: 4000,
      durationMinutes: 45,
      img: '/assets/local/service_haircut_fade.jpg',
      order: 2,
    },
    {
      name: 'Haircut & Beard',
      desc: 'Full executive haircut paired with precision beard shaping, line up, and finish.',
      priceCents: 5500,
      durationMinutes: 60,
      img: '/assets/local/hero_barber_cut.jpg',
      order: 3,
    },
    {
      name: 'Beard Trim',
      desc: 'Balanced clipper trim and scissor detailing to maintain clean proportions.',
      priceCents: 2500,
      durationMinutes: 30,
      img: '/assets/local/service_beard_shave.jpg',
      order: 4,
    },
    {
      name: 'Beard Sculpting',
      desc: 'Custom cheek and neckline contouring finished with straight-razor crispness.',
      priceCents: 3500,
      durationMinutes: 30,
      img: '/assets/local/service_beard_shave.jpg',
      order: 5,
    },
    {
      name: 'Kids Haircut',
      desc: 'Patient, clean, and comfortable haircut experience for young gentlemen.',
      priceCents: 2500,
      durationMinutes: 30,
      img: '/assets/local/service_haircut_fade.jpg',
      order: 6,
    },
    {
      name: 'Line Up / Edge Up',
      desc: 'Crisp hairline, temple, and neckline detailing between full haircut visits.',
      priceCents: 2000,
      durationMinutes: 20,
      img: '/assets/local/gallery_tools_craft.jpg',
      order: 7,
    },
    {
      name: 'Hot Towel Shave',
      desc: 'Traditional steaming towel ritual, rich lather, and close straight-razor shave.',
      priceCents: 4000,
      durationMinutes: 45,
      img: '/assets/local/service_beard_shave.jpg',
      order: 8,
    },
  ];

  const servicesCount = (db.prepare('SELECT COUNT(*) as c FROM services').get() as { c: number }).c;
  if (servicesCount === 0) {
    const insertSvc = db.prepare(`
      INSERT INTO services (id, name, description, price_cents, duration_minutes, image_url, is_active, is_owner_approved, display_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
    `);
    for (const s of defaultServices) {
      insertSvc.run(crypto.randomUUID(), s.name, s.desc, s.priceCents, s.durationMinutes, s.img, s.order);
    }
  } else {
    // Activate and price any seeded draft services that have not yet been configured by the owner
    const backfillSvc = db.prepare(`
      UPDATE services
      SET price_cents = ?,
          duration_minutes = ?,
          is_active = 1,
          is_owner_approved = 1,
          updated_at = datetime('now')
      WHERE name = ? AND price_cents IS NULL AND is_active = 0 AND is_owner_approved = 0
    `);
    for (const s of defaultServices) {
      backfillSvc.run(s.priceCents, s.durationMinutes, s.name);
    }
  }

  // 4. Placeholder Barber Profiles (Editable by Owner)
  const barbersCount = (db.prepare('SELECT COUNT(*) as c FROM barbers').get() as { c: number }).c;
  if (barbersCount === 0) {
    const placeholders = [
      {
        name: 'Chair 1 — Lead Barber',
        title: 'Placeholder Profile (Owner to Confirm)',
        bio: 'Editable barber slot reserved for Xecutive Cutz team member details, experience, and portfolio.',
        specialties: ['Precision Cuts', 'Skin Fades', 'Razor Detailing'],
        img: '/assets/local/barber_portrait_studio.jpg',
      },
      {
        name: 'Chair 2 — Senior Barber',
        title: 'Placeholder Profile (Owner to Confirm)',
        bio: 'Editable barber slot ready for the owner to customize with name, specialties, and individual hours.',
        specialties: ['Classic Haircuts', 'Beard Sculpting', 'Line Ups'],
        img: '/assets/local/hero_barber_cut.jpg',
      },
      {
        name: 'Chair 3 — Grooming Specialist',
        title: 'Placeholder Profile (Owner to Confirm)',
        bio: 'Editable barber slot ready for owner confirmation prior to live launch.',
        specialties: ['Hot Towel Shave', 'Taper Fades', 'Beard Care'],
        img: '/assets/local/service_beard_shave.jpg',
      },
    ];

    const insertBarber = db.prepare(`
      INSERT INTO barbers (id, full_name, title, bio, image_url, specialties, is_active, is_placeholder)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1)
    `);
    const insertSchedule = db.prepare(`
      INSERT INTO barber_schedules (id, barber_id, day_of_week, is_working, start_time, end_time, break_start, break_end)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const b of placeholders) {
      const bId = crypto.randomUUID();
      insertBarber.run(bId, b.name, b.title, b.bio, b.img, JSON.stringify(b.specialties));
      for (let d = 0; d <= 6; d++) {
        const works = d >= 2 && d <= 6 ? 1 : 0;
        insertSchedule.run(crypto.randomUUID(), bId, d, works, '08:00', '19:00', works ? '13:00' : null, works ? '13:30' : null);
      }
    }
  }

  // 5. Gallery Images
  const galleryCount = (db.prepare('SELECT COUNT(*) as c FROM gallery_images').get() as { c: number }).c;
  if (galleryCount === 0) {
    const gallerySeed = [
      { title: 'Executive Skin Fade & Crop', category: 'Skin Fades', img: '/assets/local/service_haircut_fade.jpg', alt: 'Fresh skin fade haircut with clean textured styling at Xecutive Cutz' },
      { title: 'Precision Clipper & Shear Work', category: 'At Work', img: '/assets/local/hero_barber_cut.jpg', alt: 'Master barber crafting a precision taper fade in Dallas' },
      { title: 'Straight Razor Beard Sculpting', category: 'Beard Styling', img: '/assets/local/service_beard_shave.jpg', alt: 'Hot towel and straight razor beard grooming session' },
      { title: 'N Haskell Ave. Shop Interior', category: 'Interior', img: '/assets/local/about_barber_interior.jpg', alt: 'Luxury dark wood and brass chairs inside Xecutive Cutz barbershop' },
      { title: 'Curated Grooming Instruments', category: 'Haircuts', img: '/assets/local/gallery_tools_craft.jpg', alt: 'Brass straight razor, Japanese shears, and clippers on slate' },
      { title: 'Studio Barber Craft', category: 'At Work', img: '/assets/local/barber_portrait_studio.jpg', alt: 'Barber holding precision shears in dark studio lighting' },
    ];
    const insertGal = db.prepare(`
      INSERT INTO gallery_images (id, title, category, image_url, alt_text, is_active, display_order)
      VALUES (?, ?, ?, ?, ?, 1, ?)
    `);
    gallerySeed.forEach((g, idx) => {
      insertGal.run(crypto.randomUUID(), g.title, g.category, g.img, g.alt, idx + 1);
    });
  }

  // 6. Grooming Journal (4 Blog Articles)
  const blogCount = (db.prepare('SELECT COUNT(*) as c FROM blog_posts').get() as { c: number }).c;
  if (blogCount === 0) {
    const posts = [
      {
        slug: 'how-to-maintain-a-fresh-fade',
        title: 'How to Maintain a Fresh Fade Between Barbershop Visits',
        excerpt: 'Keep your blend crisp, your hairline sharp, and your scalp healthy during the weeks between chair appointments.',
        category: 'Hair Care',
        img: '/assets/local/service_haircut_fade.jpg',
        content: `A precision skin fade looks sharpest on day one, when the transition from skin to crown is completely seamless. With a few deliberate daily habits, you can preserve that clean silhouette significantly longer.\n\n1. Wash with a gentle sulfate-free cleanser\nHarsh shampoos strip natural oils from both your hair and the exposed skin along the fade line, causing dryness or flaking around the temples. Stick to moisturizing formulas two to three times per week.\n\n2. Moisturize the faded perimeter\nTreat the skin around your taper like your face. A lightweight, non-comedogenic matte lotion keeps the skin smooth and prevents razor bumps along the nape.\n\n3. Use matte styling products sparingly\nHeavy oil-based pomades weigh down textured tops and quickly collect dust. A pea-sized amount of matte clay or paste warmed between your palms preserves natural lift without shine.\n\n4. Book a mid-cycle line up\nIf your crown still holds its shape at week two, a quick edge up keeps your temples and neckline looking freshly detailed until your next full cut.`,
      },
      {
        slug: 'choosing-the-right-haircut-for-your-face-shape',
        title: 'Choosing the Right Haircut for Your Face Shape',
        excerpt: 'Understanding jawline structure, forehead proportions, and crown volume so every haircut works with your natural features.',
        category: 'Style Guide',
        img: '/assets/local/hero_barber_cut.jpg',
        content: `Great barbering is proportional architecture. Before the clippers ever turn on, analyzing face geometry ensures your cut complements your bone structure rather than fighting it.\n\nOval Faces\nBalanced proportions give you versatility. Classic side parts, textured crops, and mid-to-low skin fades all frame an oval structure naturally.\n\nSquare & Rectangular Jawlines\nStrong angular features pair well with clean, structured tapers and tighter sides. Keeping slight length and texture on top avoids making the head appear overly boxy.\n\nRound Faces\nAdding subtle height at the crown while keeping the sides tapered tight creates vertical elongation and sharper definition along the cheekbones.\n\nDiamond & Heart Shapes\nTextured fringe or medium-length scissor work softens narrower chins and balances wider cheekbones. Pair with a neatly sculpted beard to anchor the lower third of the face.`,
      },
      {
        slug: 'beard-grooming-tips',
        title: 'Essential Beard Grooming Tips for a Clean, Executive Finish',
        excerpt: 'Daily hydration, directional brushing, and neckline geometry that separate an intentional beard from unruly growth.',
        category: 'Beard Care',
        img: '/assets/local/service_beard_shave.jpg',
        content: `A well-groomed beard projects structure and discipline, but coarse facial hair quickly turns wiry without consistent hydration and proper shaping.\n\nRespect the Natural Neckline\nOne of the most common at-home mistakes is shaving the neckline too high onto the jaw. A clean neckline generally sits roughly one to two fingers above the Adam's apple, creating natural shadow and fullness underneath.\n\nApply Beard Oil to Damp Skin\nBeard oil is formulated as much for the skin beneath your beard as for the hair itself. Massage three to five drops right after a warm shower while pores are open.\n\nTrain Growth with a Boar Bristle Brush\nBrushing downward daily exfoliates dry skin, distributes natural oils evenly, and trains stray hairs to lie flat along the jawline.`,
      },
      {
        slug: 'how-often-should-you-get-a-haircut',
        title: 'How Often Should You Get a Haircut?',
        excerpt: 'Finding the ideal appointment cadence based on hair texture, fade height, and personal growth rate.',
        category: 'Maintenance',
        img: '/assets/local/gallery_tools_craft.jpg',
        content: `Hair grows roughly half an inch every month, but how quickly a cut loses its shape depends heavily on the style you wear.\n\nHigh & Skin Fades: Every 1 to 2 Weeks\nBecause zero-guard fades rely on millimeter-level contrast, hair growth shows quickly around the ears and nape. Bi-weekly visits keep the transition seamless.\n\nClassic Tapers & Business Cuts: Every 3 Weeks\nTraditional scissor-over-comb tapers grow out gracefully, making a three-week cadence ideal for maintaining clean executive structure.\n\nMedium & Longer Scissor Cuts: Every 4 to 6 Weeks\nLonger styles need periodic weight removal and split-end shaping to keep volume controlled without losing length.`,
      },
    ];
    const insertPost = db.prepare(`
      INSERT INTO blog_posts (id, slug, title, excerpt, content, cover_image_url, category, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const p of posts) {
      insertPost.run(crypto.randomUUID(), p.slug, p.title, p.excerpt, p.content, p.img, p.category);
    }
  }

  // 7. Seed Owner Admin & Demo Customer accounts (real scrypt hashed passwords)
  const adminExists = db.prepare('SELECT id FROM profiles WHERE email = ?').get('admin@xecutivecutz.com');
  if (!adminExists) {
    const adminId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, password_hash, email_verified)
      VALUES (?, 'Xecutive Cutz Owner', 'admin@xecutivecutz.com', '+1 972-358-1199', ?, 1)
    `).run(adminId, hashPassword('XecutiveAdmin2026!'));
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')`).run(crypto.randomUUID(), adminId);
  }

  // Ensure only the designated owner credential account holds admin role
  db.prepare(`
    UPDATE user_roles
    SET role = 'customer'
    WHERE role = 'admin'
      AND user_id IN (SELECT id FROM profiles WHERE email != 'admin@xecutivecutz.com')
  `).run();

  const demoClientExists = db.prepare('SELECT id FROM profiles WHERE email = ?').get('client@xecutivecutz.com');
  if (!demoClientExists) {
    const clientId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO profiles (id, full_name, email, phone, password_hash, email_verified, auth_provider)
      VALUES (?, 'Demo Client', 'client@xecutivecutz.com', '+1 214-555-0148', ?, 1, 'email')
    `).run(clientId, hashPassword('ClientDemo2026!'));
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'customer')`).run(crypto.randomUUID(), clientId);
    db.prepare(`
      INSERT INTO customers (id, profile_id, full_name, email, phone, status, profile_type, email_verified, notes)
      VALUES (?, ?, 'Demo Client', 'client@xecutivecutz.com', '+1 214-555-0148', 'active', 'registered', 1, 'Demo customer account for testing')
    `).run(crypto.randomUUID(), clientId);
  }
}

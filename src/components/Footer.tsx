import { Link } from 'react-router-dom';
import { ExternalLink, MapPin, Phone, Clock, Navigation } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { DAY_SHORT, formatTime12h } from '../lib/formatters';
import { SHOP_DIRECT_DIRECTIONS_BASE } from './ShopLocationMap';

export function Footer() {
  const { settings, businessHours } = useShop();

  const address = settings?.address || '919 N Haskell Ave., Dallas, TX 75204, United States';
  const phone = settings?.phone || '+1 972-358-1199';
  const mapsUrl =
    settings?.google_maps_url ||
    'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/';

  const hasSocials = Boolean(settings?.instagram_url || settings?.facebook_url || settings?.tiktok_url);

  return (
    <footer id="contact" className="bg-[#0B0B0B] border-t border-[rgba(218,174,77,0.22)] pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-[rgba(218,174,77,0.18)]">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link to="/" className="font-serif text-2xl font-semibold text-[#F5F2EA] inline-block">
              Xecutive <span className="text-[#E9B84B]">Cutz</span>
            </Link>
            <p className="text-sm text-[#A5A29B] leading-relaxed">
              Precision grooming, tailored haircuts, and executive style in the heart of Dallas, Texas.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={SHOP_DIRECT_DIRECTIONS_BASE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#E9B84B] hover:underline"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Direct Directions</span>
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A5A29B] hover:text-[#E9B84B] transition-colors"
              >
                <span>Google Pin</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#E9B84B] mb-4">
              Navigation
            </h3>
            <ul className="space-y-2.5 text-sm text-[#A5A29B]">
              <li><Link to="/#home" className="hover:text-[#F5F2EA] transition-colors">Home</Link></li>
              <li><Link to="/#about" className="hover:text-[#F5F2EA] transition-colors">About</Link></li>
              <li><Link to="/#services" className="hover:text-[#F5F2EA] transition-colors">Services</Link></li>
              <li><Link to="/#barbers" className="hover:text-[#F5F2EA] transition-colors">Barbers</Link></li>
              <li><Link to="/#location" className="hover:text-[#F5F2EA] transition-colors">Location & Map</Link></li>
              <li><Link to="/book" className="hover:text-[#E9B84B] transition-colors">Book Appointment</Link></li>
            </ul>
          </div>

          {/* Contact & Location */}
          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#E9B84B] mb-4">
              Visit & Contact
            </h3>
            <ul className="space-y-3 text-sm text-[#A5A29B]">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                <span>{address}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                <div>
                  <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="text-[#F5F2EA] hover:text-[#E9B84B] transition-colors tabular-nums">
                    {phone}
                  </a>
                  <span className="block text-xs text-[#A5A29B]/80">Owner confirmation pending</span>
                </div>
              </li>
            </ul>

            {hasSocials && (
              <div className="mt-5 flex items-center gap-4 text-sm">
                {settings?.instagram_url && (
                  <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="text-[#E9B84B] hover:underline">
                    Instagram
                  </a>
                )}
                {settings?.facebook_url && (
                  <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="text-[#E9B84B] hover:underline">
                    Facebook
                  </a>
                )}
                {settings?.tiktok_url && (
                  <a href={settings.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-[#E9B84B] hover:underline">
                    TikTok
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-sans text-xs font-semibold tracking-wider uppercase text-[#E9B84B] mb-4">
              Business Hours
            </h3>
            <ul className="space-y-1.5 text-xs sm:text-sm text-[#A5A29B]">
              {businessHours.length > 0 ? (
                businessHours.map((h) => (
                  <li key={h.day_of_week} className="flex items-center justify-between gap-2 tabular-nums">
                    <span className="text-[#F5F2EA]">{DAY_SHORT[h.day_of_week]}</span>
                    <span>
                      {h.is_open ? `${formatTime12h(h.open_time)} – ${formatTime12h(h.close_time)}` : 'Confirm w/ Owner'}
                    </span>
                  </li>
                ))
              ) : (
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                  <span>Tue–Sat: 8:00 AM – 7:00 PM · Mon & Sun require owner confirmation</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#A5A29B]">
          <p>© {new Date().getFullYear()} {settings?.business_name || 'Xecutive Cutz'}. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-[#F5F2EA] transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-[#F5F2EA] transition-colors">
              Terms of Service
            </Link>
            <Link to="/admin" className="hover:text-[#E9B84B] transition-colors">
              Owner Portal
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

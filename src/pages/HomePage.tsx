import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Clock,
  ExternalLink,
  MapPin,
  Scissors,
  Star,
  X,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { ShopLocationMap } from '../components/ShopLocationMap';
import { LoungeAudioPlayer } from '../components/LoungeAudioPlayer';
import { BlurFade } from '../components/ui/blur-fade';
import { BorderBeam } from '../components/ui/border-beam';
import { useShop } from '../context/ShopContext';
import { useAuth } from '../context/AuthContext';
import { MEDIA, resolveMediaUrl } from '../lib/media';
import { formatCurrency, formatTime12h } from '../lib/formatters';
import type { GalleryImage } from '../types';

const GALLERY_CATEGORIES = ['All', 'Haircuts', 'Skin Fades', 'Beard Styling', 'At Work', 'Interior'] as const;

export function HomePage() {
  const { settings, businessHours, services, barbers, gallery, testimonials, blogPosts, loading } = useShop();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [galleryFilter, setGalleryFilter] = useState<(typeof GALLERY_CATEGORIES)[number]>('All');
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  const activeServices = services.filter((s) => s.is_active);
  const displayedServices = services;
  const filteredGallery =
    galleryFilter === 'All' ? gallery : gallery.filter((img) => img.category === galleryFilter);

  const rating = settings?.google_rating?.toFixed(1) || '5.0';
  const reviewCount = settings?.google_review_count ?? 6;
  const mapsUrl =
    settings?.google_maps_url ||
    'https://www.google.com/maps/place/Xecutive+Cutz/@32.7944157,-96.7776046,17z/';

  const tueSatHours = businessHours.find((h) => h.day_of_week === 2 && h.is_open);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA]">
      <Navbar />

      {/* A. HERO SECTION */}
      <section id="home" className="relative min-h-[82vh] flex items-center overflow-hidden border-b border-[rgba(218,174,77,0.22)]">
        <div className="absolute inset-0">
          <img
            src={MEDIA.heroBarberCut}
            alt="Master barber performing a precision fade haircut inside Xecutive Cutz in Dallas"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0B] via-[#0B0B0B]/84 to-[#0B0B0B]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-[#0B0B0B]/45" />
          <div className="absolute -left-24 top-1/4 w-[480px] h-[480px] rounded-full bg-[#E9B84B]/10 blur-[110px] pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="max-w-2xl space-y-6">
            <BlurFade delay={0.05} duration={0.45}>
              <div className="flex flex-wrap items-center gap-2 text-sm text-[#E9B84B] font-medium tracking-wide">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Dallas, Texas</span>
                <span aria-hidden="true" className="text-[#A5A29B]">·</span>
                <span className="text-[#A5A29B]">919 N Haskell Ave.</span>
              </div>
            </BlurFade>

            <BlurFade delay={0.14} duration={0.5}>
              <h1
                className="font-serif text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-tight text-[#F5F2EA]"
                style={{ textWrap: 'balance' }}
              >
                Precision Cuts.{' '}
                <span className="text-[#E9B84B] block sm:inline">Executive Style.</span>
              </h1>
            </BlurFade>

            <BlurFade delay={0.22} duration={0.5}>
              <p className="text-base sm:text-lg text-[#F5F2EA]/85 leading-relaxed max-w-xl">
                Experience professional grooming, precision haircuts, and effortless style at Xecutive Cutz.
              </p>
            </BlurFade>

            <BlurFade delay={0.3} duration={0.5}>
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  to="/book"
                  className="btn-gold-sheen group inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-8px_rgba(233,184,75,0.45)] transition-all duration-200 rounded-sm whitespace-nowrap"
                >
                  <span>Book Your Appointment</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 px-7 py-3.5 text-sm font-semibold text-[#F5F2EA] bg-[#141414]/85 border border-[rgba(218,174,77,0.35)] hover:border-[#E9B84B] hover:text-[#E9B84B] hover:bg-[#1C1B18] hover:-translate-y-0.5 transition-all duration-200 rounded-sm whitespace-nowrap"
                >
                  <span>Explore Services</span>
                </a>
              </div>
            </BlurFade>

            <BlurFade delay={0.38} duration={0.5}>
              <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#A5A29B] border-t border-[rgba(218,174,77,0.16)]">
                <span className="tabular-nums text-[#F5F2EA]/80">{rating} Stars on Google ({reviewCount} reviews)</span>
                <span aria-hidden="true">·</span>
                <span>Tue – Sat: {tueSatHours ? `${formatTime12h(tueSatHours.open_time)} – ${formatTime12h(tueSatHours.close_time)}` : '8:00 AM – 7:00 PM'}</span>
                <span aria-hidden="true">·</span>
                <span>Walk-ins & Instant Online Booking</span>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* B. BUSINESS HIGHLIGHTS STRIP */}
      <section className="bg-[#141414] border-b border-[rgba(218,174,77,0.22)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <BlurFade inView delay={0.04}>
              <a
                href="#testimonials"
                className="block group p-4 rounded-sm border border-transparent hover:border-[rgba(218,174,77,0.32)] hover:bg-[#1C1B18]/75 hover:-translate-y-0.5 transition-all duration-300 space-y-1"
              >
                <div className="flex items-center gap-2 font-serif text-2xl sm:text-3xl font-semibold text-[#E9B84B] tabular-nums">
                  <span>{rating}</span>
                  <Star className="w-5 h-5 fill-[#E9B84B] text-[#E9B84B] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                </div>
                <p className="text-xs sm:text-sm text-[#A5A29B] group-hover:text-[#F5F2EA]/85 transition-colors">
                  Customer Rating ({reviewCount} Google Reviews)
                </p>
              </a>
            </BlurFade>

            <BlurFade inView delay={0.1}>
              <a
                href="#location"
                className="block group p-4 rounded-sm border border-transparent hover:border-[rgba(218,174,77,0.32)] hover:bg-[#1C1B18]/75 hover:-translate-y-0.5 transition-all duration-300 space-y-1"
              >
                <div className="font-serif text-2xl sm:text-3xl font-semibold text-[#F5F2EA] group-hover:text-[#E9B84B] transition-colors">
                  Dallas, TX
                </div>
                <p className="text-xs sm:text-sm text-[#A5A29B] group-hover:text-[#F5F2EA]/85 transition-colors">
                  919 N Haskell Ave., Suite 75204
                </p>
              </a>
            </BlurFade>

            <BlurFade inView delay={0.16}>
              <Link
                to="/book"
                className="block group p-4 rounded-sm border border-transparent hover:border-[rgba(218,174,77,0.32)] hover:bg-[#1C1B18]/75 hover:-translate-y-0.5 transition-all duration-300 space-y-1"
              >
                <div className="font-serif text-2xl sm:text-3xl font-semibold text-[#F5F2EA] group-hover:text-[#E9B84B] transition-colors">
                  Online
                </div>
                <p className="text-xs sm:text-sm text-[#A5A29B] group-hover:text-[#F5F2EA]/85 transition-colors">
                  Real-Time Appointment Booking
                </p>
              </Link>
            </BlurFade>

            <BlurFade inView delay={0.22}>
              <a
                href="#services"
                className="block group p-4 rounded-sm border border-transparent hover:border-[rgba(218,174,77,0.32)] hover:bg-[#1C1B18]/75 hover:-translate-y-0.5 transition-all duration-300 space-y-1"
              >
                <div className="font-serif text-2xl sm:text-3xl font-semibold text-[#E9B84B]">
                  Grooming
                </div>
                <p className="text-xs sm:text-sm text-[#A5A29B] group-hover:text-[#F5F2EA]/85 transition-colors">
                  {activeServices.length > 0
                    ? `${activeServices.length} Active Services Available`
                    : 'Premium Barbershop Services'}
                </p>
              </a>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* C. ABOUT SECTION */}
      <section id="about" className="py-20 lg:py-28 bg-[#0B0B0B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
            <BlurFade inView className="lg:col-span-6 flex">
              <div className="group relative w-full overflow-hidden rounded-sm border border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B]/65 hover:shadow-[0_20px_45px_-16px_rgba(233,184,75,0.22)] transition-all duration-500 bg-[#141414] min-h-[340px]">
                <img
                  src={MEDIA.aboutBarberInterior}
                  alt="Xecutive Cutz barbershop interior with leather chairs and warm lighting in Dallas"
                  className="w-full h-full lg:h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <BorderBeam duration={11} size={280} borderWidth={1.5} />
              </div>
            </BlurFade>

            <BlurFade inView delay={0.12} className="lg:col-span-6 flex flex-col justify-between space-y-8">
              <div className="space-y-5">
                <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
                  About Xecutive Cutz
                </p>
                <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA] leading-tight">
                  More Than Just a Haircut.
                </h2>
                <p className="text-base text-[#A5A29B] leading-relaxed">
                  At Xecutive Cutz, grooming is about confidence, precision, and personal style. Enjoy a welcoming barbershop atmosphere and detailed attention to every cut.
                </p>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {[
                    'Professional grooming experience',
                    'Attention to detail',
                    'Welcoming environment',
                    'Convenient appointment booking',
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-[#F5F2EA] p-2.5 -mx-1 rounded-sm border border-transparent hover:border-[rgba(218,174,77,0.28)] hover:bg-[#141414] transition-all duration-200"
                    >
                      <Check className="w-4 h-4 text-[#E9B84B] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 border-t border-[rgba(218,174,77,0.22)] grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#E9B84B] font-semibold mb-1">
                    Listed Hours
                  </p>
                  <p className="text-sm text-[#F5F2EA] tabular-nums">
                    Tue – Sat: {tueSatHours ? `${formatTime12h(tueSatHours.open_time)} – ${formatTime12h(tueSatHours.close_time)}` : '8:00 AM – 7:00 PM'}
                  </p>
                  <p className="text-xs text-[#A5A29B] mt-1">
                    Mon & Sun require owner confirmation
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-[#E9B84B] font-semibold mb-1">
                    Dallas Location
                  </p>
                  <p className="text-sm text-[#F5F2EA]">919 N Haskell Ave.</p>
                  <p className="text-xs text-[#A5A29B] mt-1">Dallas, TX 75204</p>
                </div>
              </div>
            </BlurFade>
          </div>
        </div>
      </section>

      {/* D. SERVICES SECTION */}
      <section id="services" className="py-20 lg:py-28 bg-[#141414] border-y border-[rgba(218,174,77,0.22)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlurFade inView className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
                The Grooming Menu
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
                Precision in Every Cut.
              </h2>
              <p className="text-sm sm:text-base text-[#A5A29B]">
                {activeServices.length > 0
                  ? 'Explore our grooming menu, compare transparent pricing, and select any service to book online.'
                  : 'Service categories shown below are currently awaiting owner activation.'}
              </p>
            </div>
            {user?.role === 'admin' && (
              <Link
                to="/admin/services"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] hover:bg-[#E9B84B] hover:text-[#0B0B0B] transition-colors rounded-sm whitespace-nowrap shrink-0"
              >
                <span>Manage Services & Pricing</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </BlurFade>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-80 bg-[#1C1B18] border border-[rgba(218,174,77,0.12)] rounded-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {displayedServices.map((svc, idx) => {
                const hasPrice = svc.price_cents !== null && svc.price_cents !== undefined;
                const isSpotlight = idx === 0 && svc.is_active;
                return (
                  <BlurFade key={svc.id} inView delay={Math.min(idx * 0.06, 0.36)} className="flex">
                    <article className="relative group card-luxury w-full bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm overflow-hidden flex flex-col justify-between">
                      {isSpotlight && (
                        <BorderBeam
                          duration={8}
                          size={240}
                          borderWidth={1.5}
                          className="from-transparent via-[#E9B84B] to-transparent"
                        />
                      )}
                      <div>
                        <div className="aspect-[4/3] overflow-hidden bg-[#0B0B0B] relative">
                          <img
                            src={resolveMediaUrl(svc.image_url, MEDIA.serviceHaircutFade)}
                            alt={svc.name}
                            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#1C1B18] via-transparent to-transparent opacity-80" />
                          {hasPrice && (
                            <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#0B0B0B]/90 border border-[rgba(218,174,77,0.45)] group-hover:bg-[#E9B84B] group-hover:text-[#0B0B0B] group-hover:border-[#E9B84B] transition-colors duration-300 rounded-sm font-mono text-xs font-semibold text-[#E9B84B] tabular-nums">
                              {formatCurrency(svc.price_cents)}
                            </div>
                          )}
                        </div>
                        <div className="p-5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#A5A29B] tabular-nums">
                            {hasPrice ? (
                              <>
                                <span className="inline-flex items-center gap-1 text-[#F5F2EA]/80">
                                  <Clock className="w-3.5 h-3.5 text-[#E9B84B]" />
                                  <span>{svc.duration_minutes || 45} min</span>
                                </span>
                                <span className="font-mono text-sm font-semibold text-[#E9B84B]">
                                  {formatCurrency(svc.price_cents)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[#E9B84B]">Draft · Pending Owner Pricing</span>
                            )}
                          </div>
                          <h3 className="font-serif text-xl font-semibold text-[#F5F2EA] group-hover:text-[#E9B84B] transition-colors duration-200">
                            {svc.name}
                          </h3>
                          <p className="text-sm text-[#A5A29B] leading-relaxed line-clamp-3">
                            {svc.description}
                          </p>
                        </div>
                      </div>

                      <div className="px-5 pb-5 pt-2">
                        {svc.is_active ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/book?serviceId=${svc.id}`)}
                            className="btn-gold-sheen group/btn w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] hover:shadow-[0_10px_24px_-8px_rgba(233,184,75,0.45)] transition-all duration-200 rounded-sm cursor-pointer whitespace-nowrap"
                          >
                            <span>Book Now</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1" />
                          </button>
                        ) : (
                          <Link
                            to={user?.role === 'admin' ? '/admin/services' : '/book'}
                            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-[#A5A29B] border border-[rgba(218,174,77,0.22)] hover:border-[#E9B84B] hover:text-[#E9B84B] transition-colors rounded-sm whitespace-nowrap"
                          >
                            <span>{user?.role === 'admin' ? 'Approve & Set Price' : 'Awaiting Owner Approval'}</span>
                          </Link>
                        )}
                      </div>
                    </article>
                  </BlurFade>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* E. MEET OUR BARBERS */}
      <section id="barbers" className="py-20 lg:py-28 bg-[#0B0B0B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlurFade inView className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
                The Craft Team
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
                Meet Our Barbers.
              </h2>
              <p className="text-sm sm:text-base text-[#A5A29B]">
                Editable team chair profiles ready for owner confirmation of barber names, specialties, and individual schedules.
              </p>
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {barbers.map((barber, idx) => (
              <BlurFade key={barber.id} inView delay={idx * 0.08} className="flex">
                <div className="group card-luxury w-full bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="aspect-[3/4] overflow-hidden bg-[#141414] relative">
                      <img
                        src={resolveMediaUrl(barber.image_url, MEDIA.barberPortraitStudio)}
                        alt={barber.full_name}
                        className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#1C1B18] to-transparent" />
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="text-xs text-[#E9B84B]">
                        {barber.title}
                        {barber.is_placeholder && (
                          <>
                            <span aria-hidden="true" className="text-[#A5A29B]"> · </span>
                            <span className="text-[#A5A29B]">Editable Placeholder</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-serif text-2xl font-semibold text-[#F5F2EA] group-hover:text-[#E9B84B] transition-colors duration-200">
                        {barber.full_name}
                      </h3>
                      <p className="text-sm text-[#A5A29B] leading-relaxed">{barber.bio}</p>
                      {barber.specialties.length > 0 && (
                        <p className="text-xs text-[#F5F2EA]/80 pt-1">
                          {barber.specialties.join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <button
                      type="button"
                      onClick={() => navigate(`/book?barberId=${barber.id}`)}
                      className="group/btn w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold border border-[#E9B84B] text-[#E9B84B] hover:bg-[#E9B84B] hover:text-[#0B0B0B] hover:shadow-[0_10px_24px_-8px_rgba(233,184,75,0.4)] transition-all duration-200 rounded-sm cursor-pointer whitespace-nowrap"
                    >
                      <CalendarCheck className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:scale-110" />
                      <span>Book with this Barber</span>
                    </button>
                  </div>
                </div>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* F. GALLERY */}
      <section id="gallery" className="py-20 lg:py-28 bg-[#141414] border-y border-[rgba(218,174,77,0.22)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlurFade inView className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
                Portfolio & Space
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
                The Xecutive Cutz Experience.
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-[#0B0B0B] p-1.5 border border-[rgba(218,174,77,0.22)] rounded-sm">
              {GALLERY_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setGalleryFilter(cat)}
                  className={`px-3.5 py-2 text-xs font-medium rounded-sm transition-colors cursor-pointer whitespace-nowrap ${
                    galleryFilter === cat
                      ? 'bg-[#E9B84B] text-[#0B0B0B] font-semibold'
                      : 'text-[#A5A29B] hover:text-[#F5F2EA]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </BlurFade>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGallery.map((img, idx) => (
              <BlurFade key={img.id} inView delay={Math.min(idx * 0.05, 0.3)}>
                <button
                  type="button"
                  onClick={() => setLightboxImage(img)}
                  className="group card-luxury w-full relative aspect-[4/3] overflow-hidden rounded-sm border border-[rgba(218,174,77,0.22)] bg-[#1C1B18] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E9B84B]"
                >
                  <img
                    src={resolveMediaUrl(img.image_url, MEDIA.galleryToolsCraft)}
                    alt={img.alt_text}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B]/90 via-[#0B0B0B]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-5">
                    <div className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-xs text-[#E9B84B] font-medium">{img.category}</p>
                      <p className="font-serif text-lg text-[#F5F2EA]">{img.title}</p>
                    </div>
                  </div>
                </button>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* G. IN-SHOP LOUNGE ATMOSPHERE & SOUNDTRACK */}
      <section className="py-20 lg:py-24 bg-[#0B0B0B] border-b border-[rgba(218,174,77,0.22)] relative overflow-hidden">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-[#E9B84B]/8 blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <BlurFade inView className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
                  In-Shop Lounge Atmosphere
                </p>
                <h2
                  className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA] leading-tight"
                  style={{ textWrap: 'balance' }}
                >
                  Unwind Before You Step Into The Chair.
                </h2>
                <p className="text-sm sm:text-base text-[#A5A29B] leading-relaxed max-w-xl">
                  From hot-towel steam treatments and curated chill lounge acoustics to unhurried barber consultations, every appointment at Xecutive Cutz is built for calm, sharp focus.
                </p>
              </div>

              <div className="divide-y divide-[rgba(218,174,77,0.16)] border-y border-[rgba(218,174,77,0.16)]">
                {[
                  {
                    num: '01',
                    title: 'Curated Lounge Acoustics',
                    detail: 'Press play on the lounge radio to preview the warm neo-soul & Rhodes vibes inside the shop.',
                  },
                  {
                    num: '02',
                    title: 'Hot-Towel & Razor Precision',
                    detail: 'Every full-service session includes crisp edgework, tapered blending, and aromatic towel service.',
                  },
                  {
                    num: '03',
                    title: 'Zero-Wait Online Scheduling',
                    detail: 'Select your preferred barber, view real-time open slots, and confirm your chair in under a minute.',
                  },
                ].map((item) => (
                  <div key={item.num} className="py-4 flex items-start gap-4">
                    <span className="font-mono text-xs font-semibold text-[#E9B84B] pt-1 tabular-nums shrink-0">
                      {item.num}
                    </span>
                    <div className="space-y-1">
                      <h3 className="font-serif text-lg font-medium text-[#F5F2EA]">{item.title}</h3>
                      <p className="text-sm text-[#A5A29B] leading-relaxed">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </BlurFade>

            <BlurFade inView delay={0.14} className="lg:col-span-5 flex justify-center lg:justify-end">
              <LoungeAudioPlayer />
            </BlurFade>
          </div>
        </div>
      </section>

      {/* H. CUSTOMER TESTIMONIALS (Verified Google Rating + Admin Approved Only) */}
      <section id="testimonials" className="py-20 lg:py-28 bg-[#0B0B0B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlurFade inView className="text-center max-w-2xl mx-auto space-y-3 mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
              Client Feedback
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
              Verified Client Reputation.
            </h2>
            <p className="text-sm text-[#A5A29B]">
              Verified public Google rating for Xecutive Cutz in Dallas, Texas.
            </p>
          </BlurFade>

          {/* Verified Google Rating Anchor Card */}
          <BlurFade inView delay={0.08}>
            <div className="relative card-luxury max-w-3xl mx-auto bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden">
              <BorderBeam
                duration={7}
                size={280}
                borderWidth={1.5}
                className="from-transparent via-[#E9B84B] to-transparent"
              />
              <div className="space-y-2 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="w-5 h-5 fill-[#E9B84B] text-[#E9B84B]" />
                  ))}
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-semibold text-[#F5F2EA] tabular-nums">
                  {rating} out of 5.0 Stars on Google
                </h3>
                <p className="text-sm text-[#A5A29B]">
                  Based on {reviewCount} verified public Google reviews for Xecutive Cutz · 919 N Haskell Ave., Dallas, TX.
                </p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gold-sheen inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] transition-all duration-200 rounded-sm whitespace-nowrap shrink-0"
              >
                <span>Read Google Reviews</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </BlurFade>

          {testimonials.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t, idx) => (
                <BlurFade key={t.id} inView delay={Math.min(idx * 0.06, 0.3)} className="flex">
                  <blockquote className="card-luxury w-full bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm p-6 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: t.rating }).map((_, starIdx) => (
                          <Star key={starIdx} className="w-4 h-4 fill-[#E9B84B] text-[#E9B84B]" />
                        ))}
                      </div>
                      <p className="text-sm text-[#F5F2EA]/90 leading-relaxed">“{t.quote}”</p>
                    </div>
                    <footer className="text-xs text-[#A5A29B] pt-3 border-t border-[rgba(218,174,77,0.14)]">
                      <span className="text-[#F5F2EA] font-medium">{t.author_name}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{t.source}</span>
                    </footer>
                  </blockquote>
                </BlurFade>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-center text-xs text-[#A5A29B]">
              Individual client quotes are published only after owner approval in the Admin Reviews panel.
            </p>
          )}
        </div>
      </section>

      {/* I. GROOMING JOURNAL */}
      <section id="journal" className="py-20 lg:py-28 bg-[#141414] border-t border-[rgba(218,174,77,0.22)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BlurFade inView className="space-y-3 mb-12 max-w-2xl">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#E9B84B]">
              The Grooming Journal
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-semibold text-[#F5F2EA]">
              Style & Maintenance Insights.
            </h2>
          </BlurFade>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {blogPosts.map((post, idx) => (
              <BlurFade key={post.id} inView delay={Math.min(idx * 0.06, 0.24)} className="flex">
                <Link
                  to={`/journal/${post.slug}`}
                  className="group card-luxury w-full bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] overflow-hidden bg-[#0B0B0B]">
                      <img
                        src={resolveMediaUrl(post.cover_image_url, MEDIA.galleryToolsCraft)}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-5 space-y-2.5">
                      <p className="text-xs text-[#E9B84B]">{post.category}</p>
                      <h3 className="font-serif text-lg font-semibold text-[#F5F2EA] group-hover:text-[#E9B84B] transition-colors leading-snug">
                        {post.title}
                      </h3>
                      <p className="text-sm text-[#A5A29B] line-clamp-3 leading-relaxed">
                        {post.excerpt}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5 text-xs font-semibold text-[#E9B84B] inline-flex items-center gap-1.5">
                    <span>Read Article</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1.5" />
                  </div>
                </Link>
              </BlurFade>
            ))}
          </div>
        </div>
      </section>

      {/* J. GOOGLE MAPS & DIRECT DIRECTIONS */}
      <ShopLocationMap />

      {/* K. APPOINTMENT CTA BANNER */}
      <section className="relative py-24 lg:py-32 overflow-hidden border-t border-[rgba(218,174,77,0.22)]">
        <img
          src={MEDIA.aboutBarberInterior}
          alt="Reserve your seat at Xecutive Cutz barbershop"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[#0B0B0B]/82" />
        <BlurFade inView className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[rgba(218,174,77,0.35)] bg-[#141414]/80 mx-auto">
            <Scissors className="w-5 h-5 text-[#E9B84B]" />
          </div>
          <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-[#F5F2EA]">
            Your Next Great Cut Starts Here.
          </h2>
          <p className="text-base sm:text-lg text-[#A5A29B]">
            Reserve your seat and experience professional grooming at Xecutive Cutz.
          </p>
          <div className="pt-2">
            <Link
              to="/book"
              className="btn-gold-sheen group inline-flex items-center gap-2.5 px-8 py-4 text-sm font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-8px_rgba(233,184,75,0.45)] transition-all duration-200 rounded-sm"
            >
              <span>Book Your Appointment</span>
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </BlurFade>
      </section>

      <Footer />

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxImage.title}
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#141414] border border-[rgba(218,174,77,0.3)] rounded-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Close image preview"
              className="absolute top-3 right-3 z-10 w-10 h-10 bg-[#0B0B0B]/85 text-[#F5F2EA] hover:text-[#E9B84B] border border-[rgba(218,174,77,0.3)] rounded-sm flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={resolveMediaUrl(lightboxImage.image_url, MEDIA.galleryToolsCraft)}
              alt={lightboxImage.alt_text}
              className="w-full max-h-[75vh] object-contain bg-[#0B0B0B]"
              referrerPolicy="no-referrer"
            />
            <div className="p-5 flex items-center justify-between gap-4 border-t border-[rgba(218,174,77,0.18)]">
              <div>
                <p className="text-xs text-[#E9B84B]">{lightboxImage.category}</p>
                <h3 className="font-serif text-xl text-[#F5F2EA]">{lightboxImage.title}</h3>
              </div>
              <Link
                to="/book"
                className="px-4 py-2 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm whitespace-nowrap"
              >
                Book a Cut
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

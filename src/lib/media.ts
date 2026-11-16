import heroBarberCut from '../assets/images/hero_barber_cut_1794726516385.jpg';
import aboutBarberInterior from '../assets/images/about_barber_interior_1794726517384.jpg';
import serviceHaircutFade from '../assets/images/service_haircut_fade_1794726516971.jpg';
import serviceBeardShave from '../assets/images/service_beard_shave_1794726517669.jpg';
import barberPortraitStudio from '../assets/images/barber_portrait_studio_1794726517318.jpg';
import galleryToolsCraft from '../assets/images/gallery_tools_craft_1794726517952.jpg';

export const MEDIA = {
  heroBarberCut,
  aboutBarberInterior,
  serviceHaircutFade,
  serviceBeardShave,
  barberPortraitStudio,
  galleryToolsCraft,
};

const MEDIA_PATH_MAP: Record<string, string> = {
  '/assets/local/hero_barber_cut.jpg': heroBarberCut,
  '/assets/local/about_barber_interior.jpg': aboutBarberInterior,
  '/assets/local/service_haircut_fade.jpg': serviceHaircutFade,
  '/assets/local/service_beard_shave.jpg': serviceBeardShave,
  '/assets/local/barber_portrait_studio.jpg': barberPortraitStudio,
  '/assets/local/gallery_tools_craft.jpg': galleryToolsCraft,
};

export function resolveMediaUrl(url: string | null | undefined, fallback: string = serviceHaircutFade): string {
  if (!url) return fallback;
  if (MEDIA_PATH_MAP[url]) return MEDIA_PATH_MAP[url];
  return url;
}

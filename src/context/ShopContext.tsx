import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  BarberItem,
  BlogPost,
  BusinessHour,
  BusinessSettings,
  GalleryImage,
  ServiceItem,
  TestimonialItem,
} from '../types';

interface ShopBootstrap {
  settings: BusinessSettings | null;
  businessHours: BusinessHour[];
  services: ServiceItem[];
  barbers: BarberItem[];
  gallery: GalleryImage[];
  testimonials: TestimonialItem[];
  blogPosts: BlogPost[];
  systemStatus: {
    firebaseAuthConfigured?: boolean;
    firebaseProjectId?: string | null;
    supabaseConfigured: boolean;
    supabaseProjectId?: string | null;
    resendConfigured: boolean;
    googleMapsApiKey?: string;
  };
  loading: boolean;
  refreshShop: () => Promise<void>;
}

const ShopContext = createContext<ShopBootstrap | null>(null);

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Omit<ShopBootstrap, 'loading' | 'refreshShop'>>({
    settings: null,
    businessHours: [],
    services: [],
    barbers: [],
    gallery: [],
    testimonials: [],
    blogPosts: [],
    systemStatus: {
      firebaseAuthConfigured: true,
      firebaseProjectId: null,
      supabaseConfigured: true,
      supabaseProjectId: 'ulxrslukflzdswqjvczt',
      resendConfigured: false,
      googleMapsApiKey: '',
    },
  });
  const [loading, setLoading] = useState(true);

  const refreshShop = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShop();
  }, [refreshShop]);

  return (
    <ShopContext.Provider value={{ ...data, loading, refreshShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside ShopProvider');
  return ctx;
}

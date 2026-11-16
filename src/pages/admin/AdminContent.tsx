import { useCallback, useEffect, useState } from 'react';
import { Plus, Star, Trash2, Upload } from 'lucide-react';
import { useShop } from '../../context/ShopContext';
import { apiFetch } from '../../lib/api';
import { MEDIA, resolveMediaUrl } from '../../lib/media';
import type { BlogPost, GalleryImage, TestimonialItem } from '../../types';

export function AdminGallery() {
  const { refreshShop } = useShop();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GalleryImage['category']>('Haircuts');
  const [imageUrl, setImageUrl] = useState('/assets/local/service_haircut_fade.jpg');
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch('/api/admin/gallery');
    if (res.ok) {
      const d = await res.json();
      setImages(d.images || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch('/api/admin/upload', { method: 'POST', body: fd });
    const d = await res.json();
    setUploading(false);
    if (res.ok) setImageUrl(d.url);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, image_url: imageUrl, alt_text: altText || title }),
    });
    setTitle('');
    setAltText('');
    await load();
    await refreshShop();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/admin/gallery/${id}`, { method: 'DELETE' });
    await load();
    await refreshShop();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Gallery Management</h1>
        <p className="text-xs text-[#A5A29B] mt-1">Upload and categorize haircut, beard, and interior photography.</p>
      </div>

      <form
        onSubmit={handleAdd}
        className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end"
      >
        <div>
          <label className="block text-[#A5A29B] mb-1">Photo Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mid Skin Fade"
            className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
          />
        </div>
        <div>
          <label className="block text-[#A5A29B] mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as GalleryImage['category'])}
            className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
          >
            <option value="Haircuts">Haircuts</option>
            <option value="Skin Fades">Skin Fades</option>
            <option value="Beard Styling">Beard Styling</option>
            <option value="At Work">At Work</option>
            <option value="Interior">Interior</option>
          </select>
        </div>
        <div>
          <label className="block text-[#A5A29B] mb-1">Upload Image</label>
          <label className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 bg-[#1C1B18] border border-[rgba(218,174,77,0.3)] rounded-sm cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#E9B84B]" />
            <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </label>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 py-2 px-4 font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add to Gallery</span>
        </button>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm overflow-hidden"
          >
            <img
              src={resolveMediaUrl(img.image_url, MEDIA.galleryToolsCraft)}
              alt={img.alt_text}
              className="w-full aspect-[4/3] object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="p-4 flex items-center justify-between gap-2 text-xs">
              <div>
                <p className="text-[#E9B84B]">{img.category}</p>
                <p className="font-medium text-[#F5F2EA]">{img.title}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(img.id)}
                className="p-2 text-rose-300 border border-rose-500/30 rounded-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminReviews() {
  const { refreshShop } = useShop();
  const [reviews, setReviews] = useState<TestimonialItem[]>([]);
  const [authorName, setAuthorName] = useState('');
  const [source, setSource] = useState('Verified Google Review');
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');

  const load = useCallback(async () => {
    const res = await apiFetch('/api/admin/testimonials');
    if (res.ok) {
      const d = await res.json();
      setReviews(d.testimonials || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: authorName,
        source,
        rating,
        quote,
        is_verified_google: source.toLowerCase().includes('google'),
        is_approved: true,
      }),
    });
    setAuthorName('');
    setQuote('');
    await load();
    await refreshShop();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
    await load();
    await refreshShop();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Reviews & Testimonials</h1>
        <p className="text-xs text-[#A5A29B] mt-1">
          Only authentic, verified client reviews entered by the business owner are displayed on the website.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-4 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[#A5A29B] mb-1">Client Name</label>
            <input
              required
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Client Name"
              className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            />
          </div>
          <div>
            <label className="block text-[#A5A29B] mb-1">Source</label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            />
          </div>
          <div>
            <label className="block text-[#A5A29B] mb-1">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} Stars
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[#A5A29B] mb-1">Verified Testimonial Quote</label>
          <textarea
            required
            rows={3}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Paste an authentic customer review approved for publication..."
            className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2.5 font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Verified Testimonial</span>
        </button>
      </form>

      {reviews.length === 0 ? (
        <p className="text-xs text-[#A5A29B]">
          No individual testimonials added yet. Homepage currently shows the verified 5.0-star Google rating summary.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 flex justify-between gap-4"
            >
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-1">
                  {Array.from({ length: r.rating }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-[#E9B84B] text-[#E9B84B]" />
                  ))}
                </div>
                <p className="text-[#F5F2EA]">“{r.quote}”</p>
                <p className="text-[#A5A29B]">
                  {r.author_name} · {r.source}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                className="p-2 h-fit text-rose-300 border border-rose-500/30 rounded-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminBlog() {
  const { refreshShop } = useShop();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Grooming Guide');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');

  const load = useCallback(async () => {
    const res = await apiFetch('/api/admin/blog');
    if (res.ok) {
      const d = await res.json();
      setPosts(d.posts || []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, category, excerpt, content, is_published: true }),
    });
    setTitle('');
    setExcerpt('');
    setContent('');
    await load();
    await refreshShop();
  };

  const togglePublish = async (p: BlogPost) => {
    await apiFetch(`/api/admin/blog/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !p.is_published }),
    });
    await load();
    await refreshShop();
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
    await load();
    await refreshShop();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold">Grooming Journal Management</h1>
        <p className="text-xs text-[#A5A29B] mt-1">Publish and manage grooming articles displayed on the homepage.</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-5 space-y-3 text-xs"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            required
            placeholder="Article Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
          />
          <input
            placeholder="Category (e.g. Beard Care)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
          />
        </div>
        <input
          placeholder="Short Excerpt"
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
        />
        <textarea
          required
          rows={4}
          placeholder="Full Article Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-3 py-2 bg-[#0B0B0B] border border-[rgba(218,174,77,0.22)] rounded-sm"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2.5 font-semibold bg-[#E9B84B] text-[#0B0B0B] rounded-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Publish Article</span>
        </button>
      </form>

      <div className="space-y-3">
        {posts.map((p) => (
          <div
            key={p.id}
            className="bg-[#141414] border border-[rgba(218,174,77,0.22)] rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
          >
            <div className="space-y-1">
              <span className="text-[#E9B84B]">{p.category}</span>
              <h3 className="font-serif text-lg font-semibold text-[#F5F2EA]">{p.title}</h3>
              <p className="text-[#A5A29B]">{p.excerpt}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => togglePublish(p)}
                className={`px-3 py-1.5 rounded-sm border cursor-pointer ${
                  p.is_published
                    ? 'border-emerald-500/40 text-emerald-300'
                    : 'border-amber-500/40 text-amber-300'
                }`}
              >
                {p.is_published ? 'Published' : 'Draft'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.id)}
                className="p-2 text-rose-300 border border-rose-500/30 rounded-sm cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { MEDIA, resolveMediaUrl } from '../lib/media';
import type { BlogPost } from '../types';

export function JournalArticlePage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/blog/${slug}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Article not found.');
        return r.json();
      })
      .then((data) => setPost(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-[#0B0B0B] text-[#F5F2EA] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-14">
        <Link to="/#journal" className="inline-flex items-center gap-2 text-sm text-[#E9B84B] hover:underline mb-8">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Grooming Journal</span>
        </Link>

        {loading && <div className="h-64 bg-[#141414] rounded-sm animate-pulse" />}
        {error && (
          <div className="p-8 bg-[#1C1B18] border border-[rgba(218,174,77,0.22)] rounded-sm">
            <p className="text-[#A5A29B]">{error}</p>
          </div>
        )}

        {post && (
          <article className="space-y-8">
            <header className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#E9B84B]">
                {post.category}
              </p>
              <h1 className="font-serif text-3xl sm:text-5xl font-semibold leading-tight text-[#F5F2EA]">
                {post.title}
              </h1>
              <p className="text-base text-[#A5A29B] leading-relaxed">{post.excerpt}</p>
            </header>

            <div className="aspect-[16/9] overflow-hidden rounded-sm border border-[rgba(218,174,77,0.22)] bg-[#141414]">
              <img
                src={resolveMediaUrl(post.cover_image_url, MEDIA.galleryToolsCraft)}
                alt={post.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="space-y-5 text-[#F5F2EA]/90 leading-relaxed whitespace-pre-line text-base">
              {post.content}
            </div>

            <div className="pt-8 border-t border-[rgba(218,174,77,0.22)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1C1B18] p-6 rounded-sm border">
              <div>
                <h2 className="font-serif text-xl text-[#F5F2EA]">Ready for your next cut?</h2>
                <p className="text-sm text-[#A5A29B]">Book your seat online at Xecutive Cutz in Dallas.</p>
              </div>
              <Link
                to="/book"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-[#E9B84B] text-[#0B0B0B] hover:bg-[#C99B3C] rounded-sm whitespace-nowrap"
              >
                <span>Book Appointment</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}

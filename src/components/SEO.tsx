import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
}

export default function SEO({
  title,
  description,
  keywords = '',
  ogImage = 'https://desk.samuhia.co.ke/og-image.png',
  ogType = 'website',
  canonicalUrl = `https://desk.samuhia.co.ke${window.location.pathname}`
}: SEOProps) {
  useEffect(() => {
    // Set document title
    document.title = title;

    // Helper function to set or update meta tags
    const setMetaTag = (property: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${property}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, property);
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    // Set or update link tags
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
      
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      
      element.href = href;
    };

    // Basic meta tags
    setMetaTag('description', description);
    if (keywords) setMetaTag('keywords', keywords);
    setMetaTag('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMetaTag('author', 'Samuhia');

    // Open Graph tags
    setMetaTag('og:title', title, true);
    setMetaTag('og:description', description, true);
    setMetaTag('og:type', ogType, true);
    setMetaTag('og:url', canonicalUrl, true);
    setMetaTag('og:image', ogImage, true);
    setMetaTag('og:image:width', '1200', true);
    setMetaTag('og:image:height', '630', true);
    setMetaTag('og:image:alt', 'Samuhia Desk — support desk for chamas, schools and landlords in Kenya', true);
    setMetaTag('og:site_name', 'Samuhia Desk', true);
    setMetaTag('og:locale', 'en_KE', true);

    // Twitter Card tags
    setMetaTag('twitter:card', 'summary_large_image');
    setMetaTag('twitter:title', title);
    setMetaTag('twitter:description', description);
    setMetaTag('twitter:image', ogImage);
    setMetaTag('twitter:image:alt', 'Samuhia Desk — support desk for chamas, schools and landlords in Kenya');

    // Canonical URL
    setLinkTag('canonical', canonicalUrl);

    // Geo tags for Kenya
    setMetaTag('geo.region', 'KE');
    setMetaTag('geo.placename', 'Kenya');

    // Mobile-specific
    setMetaTag('mobile-web-app-capable', 'yes');
    setMetaTag('apple-mobile-web-app-capable', 'yes');
    setMetaTag('apple-mobile-web-app-title', 'Samuhia Desk');

    // Theme color
    setMetaTag('theme-color', '#0B1210');
  }, [title, description, keywords, ogImage, ogType, canonicalUrl]);

  return null;
}
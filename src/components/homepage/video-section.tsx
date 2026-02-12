"use client";

import { useLanguage } from '@/hooks/useLanguage';

interface VideoSectionContent {
  title?: string | Record<string, string>;
  videoUrl: string;
  description?: string | Record<string, string>;
}

interface VideoSectionProps {
  content: VideoSectionContent;
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;

  // YouTube: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
  const ytWatchMatch = url.match(/(?:youtube\.com\/watch\?.*v=)([\w-]+)/);
  if (ytWatchMatch) return `https://www.youtube-nocookie.com/embed/${ytWatchMatch[1]}`;

  const ytShortMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (ytShortMatch) return `https://www.youtube-nocookie.com/embed/${ytShortMatch[1]}`;

  const ytEmbedMatch = url.match(/youtube\.com\/embed\/([\w-]+)/);
  if (ytEmbedMatch) return `https://www.youtube-nocookie.com/embed/${ytEmbedMatch[1]}`;

  // Vimeo: vimeo.com/ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  return null;
}

export function VideoSection({ content }: VideoSectionProps) {
  const { tc } = useLanguage();

  if (!content?.videoUrl) return null;

  const embedUrl = getEmbedUrl(content.videoUrl);
  if (!embedUrl) return null;

  const title = content.title ? tc(content.title) : undefined;
  const description = content.description ? tc(content.description) : undefined;

  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="container mx-auto px-4 max-w-4xl">
        {(title || description) && (
          <div className="text-center mb-8">
            {title && (
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </div>
        )}
        <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ aspectRatio: '16/9' }}>
          <iframe
            src={embedUrl}
            title={title || 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 w-full h-full border-0"
          />
        </div>
      </div>
    </section>
  );
}

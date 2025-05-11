// src/components/property/page-header.tsx
"use client";

import { PageHeaderBlock } from '@/lib/overridesSchemas-multipage';

interface PageHeaderProps {
  content: PageHeaderBlock;
}

export function PageHeader({ content }: PageHeaderProps) {
  const { title, subtitle, backgroundImage } = content;

  return (
    <div 
      className="relative py-24 md:py-32 bg-cover bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${backgroundImage})` }}
    >
      <div className="container mx-auto px-4 text-center text-white">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
        {subtitle && <p className="text-xl md:text-2xl max-w-3xl mx-auto">{subtitle}</p>}
      </div>
    </div>
  );
}
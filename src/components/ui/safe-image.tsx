"use client";

import React, { useState } from 'react';
import Image, { ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';

interface SafeImageProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackText?: string;
}

/**
 * A wrapper around Next.js Image component that handles loading errors gracefully
 * and provides a fallback UI when images fail to load
 */
export function SafeImage({
  alt,
  src,
  fallbackText,
  className,
  style,
  ...props
}: SafeImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  // Calculate default dimensions based on props
  const defaultHeight = typeof props.height === 'number' ? props.height : 300;
  const defaultWidth = typeof props.width === 'number' ? props.width : 400;

  // If there's an error or the src is invalid, show fallback
  if (error || !src) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted ${className || ''}`}
        style={{
          ...style,
          minHeight: props.fill ? '100%' : `${defaultHeight / 2}px`,
          minWidth: props.fill ? '100%' : `${defaultWidth / 2}px`,
          position: props.fill ? 'absolute' : 'relative',
          inset: props.fill ? 0 : undefined,
          aspectRatio: props.fill ? undefined : (defaultWidth / defaultHeight),
        }}
      >
        <div className="flex flex-col items-center text-muted-foreground p-4 text-center">
          <ImageOff className="h-8 w-8 mb-2 opacity-70" />
          <span className="text-sm">
            {fallbackText || alt || "Image unavailable"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div 
          className={`flex items-center justify-center bg-muted/50 ${className || ''}`}
          style={{
            ...style,
            position: props.fill ? 'absolute' : 'relative',
            inset: props.fill ? 0 : undefined,
          }}
        >
          <div className="w-10 h-10 rounded-full bg-muted/80 animate-pulse" />
        </div>
      )}
      <Image
        src={src}
        alt={alt || ""}
        className={`${className || ''} ${!loaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={{
          ...style,
          objectFit: style?.objectFit || 'cover',
        }}
        onError={() => setError(true)}
        onLoad={() => setLoaded(true)}
        {...props}
      />
    </>
  );
}
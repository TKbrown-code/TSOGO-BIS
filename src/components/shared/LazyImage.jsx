import React, { useState, useEffect, useRef } from 'react';

/**
 * LazyImage Component - Implements lazy loading for images
 * @param {string} src - Image source URL
 * @param {string} srcSet - Responsive image sources (optional)
 * @param {string} sizes - Image sizes for responsive loading (optional)
 * @param {string} alt - Alt text for accessibility
 * @param {string} className - CSS class name
 * @param {string} placeholder - Placeholder image URL (optional)
 * @param {object} style - Inline styles
 */
export default function LazyImage({ 
  src, 
  srcSet,
  sizes,
  alt = '', 
  className = '', 
  placeholder = '/placeholder.png',
  style = {},
  ...props 
}) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    let observer;
    
    if (imgRef.current && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              observer.unobserve(entry.target);
            }
          });
        },
        {
          rootMargin: '200px', // Start loading 200px before image enters viewport for smoother UX
        }
      );

      observer.observe(imgRef.current);
    } else {
      // Fallback for browsers that don't support IntersectionObserver
      setImageSrc(src);
    }

    return () => {
      if (observer && imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src]);

  const handleLoad = () => {
    setImageLoaded(true);
  };

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      className={`${className} ${imageLoaded ? 'loaded' : 'loading'}`}
      style={{
        ...style,
        opacity: imageLoaded ? 1 : 0.6,
        transition: 'opacity 0.3s ease-in-out',
      }}
      onLoad={handleLoad}
      loading="lazy" // Native lazy loading as fallback
      decoding="async" // Async decode for better performance
      {...props}
    />
  );
}

interface OptimizedImageProps {
  src: string
  alt: string
  className?: string
  width?: number
  height?: number
  loading?: 'lazy' | 'eager'
}

export function OptimizedImage({
  src,
  alt,
  className,
  width,
  height,
  loading = 'lazy'
}: OptimizedImageProps) {
  // Generate WebP source path
  const webpSrc = src.replace(/\.(png|jpe?g)$/, '.webp')
  
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading={loading}
      />
    </picture>
  )
} 
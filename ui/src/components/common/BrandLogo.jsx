export default function BrandLogo({ className = '', alt = 'ANDO', ...props }) {
  return (
    <img
      src="/ando-logo.jpeg"
      alt={alt}
      className={`object-cover rounded-full shadow-2xl ${className}`.trim()}
      {...props}
    />
  );
}

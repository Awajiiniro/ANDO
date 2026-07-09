export default function BrandLogo({ className = '', alt = 'ANDO', ...props }) {
  return (
    <img
      src="/ANDO_LOGO.jpeg"
      alt={alt}
      className={`object-cover rounded-full shadow-2xl ${className}`.trim()}
      {...props}
    />
  );
}

export function Card({ children, inactive, className = '', onClick, style }) {
  return (
    <article
      className={`card${inactive ? ' is-inactive' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </article>
  );
}

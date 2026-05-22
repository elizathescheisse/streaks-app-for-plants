/** Shared card primitive — maps to global `.ds-card` in theme/globals.css */
export default function Card({ className = '', as: Tag = 'div', children, ...props }) {
  const classes = ['ds-card', className].filter(Boolean).join(' ')
  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  )
}

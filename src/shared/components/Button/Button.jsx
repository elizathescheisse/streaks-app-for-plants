const VARIANT_CLASS = {
  primary: 'ds-btn-primary',
  secondary: 'ds-btn-secondary',
  ghost: 'ds-btn-ghost',
  icon: 'ds-btn-icon',
  destructive: 'ds-btn-destructive',
}

/** Shared button primitive — maps to global `.ds-btn-*` classes in theme/globals.css */
export default function Button({ variant = 'primary', className = '', type = 'button', ...props }) {
  const variantClass = VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary
  const classes = [variantClass, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...props} />
}

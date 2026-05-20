export default {content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-elevated': 'var(--primary-elevated)',
        secondary: 'var(--secondary)',
        'secondary-hover': 'var(--secondary-hover)',
        'secondary-elevated': 'var(--secondary-elevated)',
        tertiary: 'var(--tertiary)',
        'tertiary-hover': 'var(--tertiary-hover)',
        'tertiary-elevated': 'var(--tertiary-elevated)',
        foreground: 'var(--foreground)',
        'foreground-muted': 'var(--foreground-muted)',
        'foreground-subtle': 'var(--foreground-subtle)',
        background: 'var(--background)',
        'background-muted': 'var(--background-muted)',
        'background-subtle': 'var(--background-subtle)',
        success: 'var(--success)',
        'success-hover': 'var(--success-hover)',
        'success-elevated': 'var(--success-elevated)',
        warning: 'var(--warning)',
        'warning-hover': 'var(--warning-hover)',
        'warning-elevated': 'var(--warning-elevated)',
        error: 'var(--error)',
        'error-hover': 'var(--error-hover)',
        'error-elevated': 'var(--error-elevated)',
        info: 'var(--info)',
        'info-hover': 'var(--info-hover)',
        'info-elevated': 'var(--info-elevated)'
      },
      fontFamily: {
        heading: ['Inter'],
        mono: ['"Fira Code"']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)'
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)'
      }
    }
  }
}
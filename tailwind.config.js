/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
        blue: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },
        green: {
          50: '#ECFDF5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        yellow: {
          50: '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
        },
        red: {
          50: '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
        },
      },
      fontWeight: {
        '450': 450,
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', '0.9375rem'],
        'xs': ['0.75rem', '1rem'],
        'sm': ['0.8125rem', '1.125rem'],
        'base': ['0.875rem', '1.25rem'],
        'lg': ['0.9375rem', '1.375rem'],
        'xl': ['1rem', '1.5rem'],
        '2xl': ['1.125rem', '1.625rem'],
        '3xl': ['1.5rem', '2rem'],
      },
    },
  },
  plugins: [],
};

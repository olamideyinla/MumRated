/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          50: '#E8F5EE',
          100: '#C5E4D1',
          200: '#9BCFB0',
          300: '#71BA8F',
          400: '#4DA876',
          500: '#2D6A4F',
          600: '#256040',
          700: '#1B5132',
          800: '#123D24',
          900: '#092918',
        },
        secondary: {
          DEFAULT: '#8B6914',
          50: '#FDF5E6',
          100: '#F7E3B3',
          200: '#F0CF7D',
          300: '#E9BB47',
          400: '#DDA820',
          500: '#8B6914',
          600: '#7A5C11',
          700: '#634A0D',
          800: '#4C380A',
          900: '#352606',
        },
        accent: {
          DEFAULT: '#DAA520',
          light: '#F0CC5A',
          dark: '#B8891A',
        },
        earth: {
          50: '#FAF7F2',
          100: '#F0E8D8',
          200: '#E0CEAF',
          300: '#CBB086',
          400: '#B89460',
          500: '#8B6914',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      screens: {
        xs: '375px',
      },
      height: {
        dvh: '100dvh',
      },
      minHeight: {
        dvh: '100dvh',
      },
    },
  },
  plugins: [],
}

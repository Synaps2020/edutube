import type { Config } from 'tailwindcss';

// Identité visuelle : charte graphique du SIMEN (Système d'Information de Management de
// l'Éducation Nationale) — bleu #0099CC (principal), bleu clair #BED1E0, orange #FF9900,
// gris #666666 / #7F7F7F / #CFCFCF ; typographie Trebuchet MS (principale), Century Gothic
// (secondaire). Les couleurs nationales (vert / jaune / rouge) ne sont utilisées qu'en
// accent discret (liseré tricolore), conformément à la charte qui interdit de placer le
// logotype sur des aplats bleu, orange, bleu clair ou rouge.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        simen: {
          blue: { DEFAULT: '#0099CC', dark: '#007AA3', darker: '#005C7A', light: '#E5F4FA' },
          sky: { DEFAULT: '#BED1E0', light: '#E8EFF5' },
          orange: { DEFAULT: '#FF9900', dark: '#CC7A00', light: '#FFF3E0' },
          gray: { DEFAULT: '#666666', mid: '#7F7F7F', light: '#CFCFCF', lighter: '#F2F2F2', dark: '#3C3C3C' },
        },
        sn: {
          green: { DEFAULT: '#00853F', light: '#E6F4EC' },
          yellow: { DEFAULT: '#FDEF42', light: '#FFFBD6' },
          red: { DEFAULT: '#E31B23', light: '#FDE8E9' },
        },
      },
      fontFamily: {
        sans: ['"Trebuchet MS"', '"Century Gothic"', 'Tahoma', 'Verdana', 'Segoe UI', 'sans-serif'],
        secondary: ['"Century Gothic"', '"Trebuchet MS"', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;

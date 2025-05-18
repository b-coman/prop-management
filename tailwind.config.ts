import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    './pages/**/*.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './app/**/*.{ts,tsx,js,jsx}',
    './@/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}', // Ensure src directory is included
  ],
  theme: {
  	extend: {
  		colors: {
        // Airbnb specific colors (keep for backward compatibility)
        'airbnb-red': '#FF5A5F',
        'airbnb-pink': '#FF385C',
        'airbnb-dark-gray': '#222222',
        'airbnb-light-gray': '#717171',
        
        // Theme colors using CSS variables
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
        // Keep original radius for backward compatibility
        'airbnb': '32px',
        
        // Theme-aware border radius
  			DEFAULT: 'var(--radius)',
  			sm: 'calc(var(--radius) - 0.125rem)',
  			md: 'calc(var(--radius) - 0.0625rem)',
  			lg: 'calc(var(--radius) + 0.0625rem)',
  			xl: 'calc(var(--radius) + 0.125rem)',
  			
  			// Component-specific border radius
  			button: 'var(--button-radius)',
  			card: 'var(--card-radius)',
  			input: 'var(--input-radius)'
  		},
       fontFamily: {
        // Primary font family from theme
        sans: ['var(--font-family)', 'var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      
      // Theme-aware shadows
      boxShadow: {
        button: 'var(--button-shadow)',
        card: 'var(--card-shadow)',
      },
      
      // Theme-aware spacing values
      padding: {
        button: 'var(--button-padding)',
        card: 'var(--card-padding)',
        input: 'var(--input-padding)',
      },
      
      // Theme-aware border widths
      borderWidth: {
        card: 'var(--card-border-width)',
        input: 'var(--input-border-width)',
      },
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;

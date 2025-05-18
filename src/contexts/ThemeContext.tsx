"use client";

import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { Theme, getThemeById, DEFAULT_THEME_ID } from "@/lib/themes/theme-definitions";
import { applyThemeToDOM, loadFont } from "@/lib/themes/theme-utils";

/**
 * Context type definition for the theme context
 */
interface ThemeContextType {
  theme: Theme; // Current theme
  setTheme: (id: string) => void; // Function to change the theme
}

// Create the context with undefined as default
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * ThemeProvider component that wraps the application and provides theme context
 */
export function ThemeProvider({
  children,
  initialThemeId = DEFAULT_THEME_ID,
}: {
  children: ReactNode;
  initialThemeId?: string;
}) {
  // Initialize theme from the provided ID or default
  const [theme, setThemeState] = useState<Theme>(() => getThemeById(initialThemeId));

  // Function to change the current theme
  const setTheme = (id: string) => {
    const newTheme = getThemeById(id);
    setThemeState(newTheme);

    // Store theme preference in localStorage for persistence
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", id);
    }
  };

  // Apply the theme when it changes
  useEffect(() => {
    // Skip applying theme on server
    if (typeof window === "undefined") return;

    // Apply theme CSS variables to DOM
    applyThemeToDOM(theme);

    // Load font for the theme
    loadFont(theme.typography.fontFamilyUrl);
  }, [theme]);

  // Context value
  const contextValue = {
    theme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Custom hook to use the theme context
 * @returns The theme context
 * @throws Error if used outside of a ThemeProvider
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  
  return context;
}
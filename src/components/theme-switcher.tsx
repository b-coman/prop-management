"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * ThemeSwitcher component that can be added to any page for testing themes
 * Shows a small collapsible panel for switching between available themes
 */
export function ThemeSwitcher({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  
  const themeOptions = [
    { id: "airbnb", name: "Airbnb", color: "#FF385C" },
    { id: "ocean", name: "Ocean Blue", color: "#00A0F0" },
    { id: "forest", name: "Forest Green", color: "#3B9A63" },
    { id: "modern", name: "Modern", color: "#0078FF" },
    { id: "luxury", name: "Luxury", color: "#FFC000" }
  ];
  
  // Toggle panel open/closed
  const togglePanel = () => setIsOpen(!isOpen);
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {/* Floating button */}
      <button 
        onClick={togglePanel}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-white shadow-lg hover:opacity-90"
        title="Theme Switcher"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </button>
      
      {/* Theme panel */}
      {isOpen && (
        <div className="absolute bottom-12 right-0 w-64 p-3 rounded-md bg-white shadow-lg border">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-medium">Theme Switcher</h3>
            <button 
              onClick={togglePanel}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setTheme(option.id)}
                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center ${
                  theme.id === option.id 
                    ? 'bg-gray-100 font-medium' 
                    : 'hover:bg-gray-50'
                }`}
              >
                <span 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: option.color }}
                />
                {option.name}
                {theme.id === option.id && (
                  <svg className="ml-auto" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
"use client"

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";
import { predefinedThemes } from "@/lib/themes/theme-definitions";

/**
 * Props for the ThemeSelector component
 */
interface ThemeSelectorProps {
  /**
   * The currently selected theme ID
   */
  selectedThemeId: string;
  
  /**
   * Callback for when theme selection changes
   */
  onThemeChange: (id: string) => void;
}

/**
 * ThemeSelector Component
 * 
 * Displays a grid of theme options with previews that property owners can select from.
 */
export function ThemeSelector({ selectedThemeId, onThemeChange }: ThemeSelectorProps) {
  // Track which theme is being hovered
  const [hoveredThemeId, setHoveredThemeId] = useState<string | null>(null);
  
  return (
    <RadioGroup 
      value={selectedThemeId} 
      onValueChange={onThemeChange}
      className="grid grid-cols-1 md:grid-cols-3 gap-4"
    >
      {predefinedThemes.map((themeOption) => (
        <div key={themeOption.id} className="relative">
          <RadioGroupItem 
            value={themeOption.id} 
            id={themeOption.id} 
            className="sr-only" 
          />
          <Label 
            htmlFor={themeOption.id} 
            className="cursor-pointer block h-full"
            onMouseEnter={() => setHoveredThemeId(themeOption.id)}
            onMouseLeave={() => setHoveredThemeId(null)}
          >
            <Card className={`overflow-hidden h-full transition-all duration-300 
              ${selectedThemeId === themeOption.id 
                ? 'ring-4 ring-primary shadow-lg scale-[1.02] z-10' 
                : hoveredThemeId === themeOption.id 
                  ? 'ring-2 ring-primary/50 shadow-md scale-[1.01] border-primary/75' 
                  : 'border hover:border-primary'}`}>
              <div className="aspect-video relative">
                <div 
                  className="w-full h-full bg-gradient-to-r"
                  style={{ 
                    backgroundImage: `linear-gradient(to right, hsl(${themeOption.colors.primary}), hsl(${themeOption.colors.accent}))` 
                  }}
                />
                {selectedThemeId === themeOption.id && (
                  <div className="absolute top-3 right-3 p-1 rounded-full bg-white shadow-md">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                )}
                {selectedThemeId === themeOption.id && (
                  <div className="absolute top-0 left-0 w-full text-center py-1 px-2 text-xs font-medium bg-primary text-white">
                    Active Theme
                  </div>
                )}
                {hoveredThemeId === themeOption.id && selectedThemeId !== themeOption.id && (
                  <div className="absolute bottom-0 left-0 w-full text-center py-1 px-2 text-xs font-medium bg-primary/75 text-white">
                    Click to Select
                  </div>
                )}
              </div>
              <CardHeader className="p-4">
                <h3 className="font-medium flex items-center">
                  {themeOption.name}
                  {selectedThemeId === themeOption.id && <span className="ml-2 text-xs py-0.5 px-2 rounded-full bg-primary/10 text-primary">Selected</span>}
                </h3>
                <p className="text-sm text-muted-foreground">{themeOption.description}</p>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex gap-2">
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.primary})` }}
                    title="Primary color"
                  />
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.accent})` }}
                    title="Accent color"
                  />
                  <div 
                    className="w-6 h-6 rounded-full shadow-sm" 
                    style={{ background: `hsl(${themeOption.colors.secondary})` }}
                    title="Secondary color"
                  />
                </div>
                
                {/* Font preview */}
                <div className="mt-3 p-2 bg-gray-50 rounded text-xs overflow-hidden">
                  <div style={{ fontFamily: themeOption.typography.fontFamily }}>
                    <span className="block truncate" style={{ fontWeight: themeOption.typography.headingWeight }}>
                      Heading Text
                    </span>
                    <span className="block truncate" style={{ fontWeight: themeOption.typography.bodyWeight }}>
                      Body text sample
                    </span>
                  </div>
                </div>
                
                {/* Component styles preview */}
                <div className="mt-2 flex gap-2">
                  <div 
                    className="text-xs rounded shadow-sm py-1 px-2 text-white"
                    style={{ 
                      background: `hsl(${themeOption.colors.primary})`,
                      borderRadius: themeOption.sizing.buttonRadius,
                    }}
                  >
                    Button
                  </div>
                  <div 
                    className="text-xs rounded-full shadow-sm py-1 px-2 bg-gray-100"
                    style={{ 
                      borderRadius: themeOption.sizing.buttonRadius,
                    }}
                  >
                    Pill
                  </div>
                </div>
                
                {/* Preview Theme Button */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Get the property slug from the URL
                      const urlParts = window.location.pathname.split('/');
                      const propertiesIndex = urlParts.findIndex(part => part === 'properties');
                      const propertySlug = urlParts[propertiesIndex + 1];
                      
                      if (propertySlug) {
                        // Open property page with theme preview parameter
                        window.open(`/properties/${propertySlug}?preview_theme=${themeOption.id}`, '_blank');
                      }
                    }}
                    className="text-xs w-full py-1.5 px-2 rounded border border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    Preview Theme
                  </button>
                </div>
              </CardContent>
            </Card>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
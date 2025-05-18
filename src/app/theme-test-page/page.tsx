"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { predefinedThemes } from "@/lib/themes/theme-definitions";

export default function ThemeTestPage() {
  console.log("Available themes:", predefinedThemes);
  const [selectedThemeId, setSelectedThemeId] = useState(predefinedThemes[0]?.id || "airbnb");

  // Fallback buttons if themes aren't loading correctly
  const fallbackThemes = [
    { id: "airbnb", name: "Airbnb" },
    { id: "ocean", name: "Ocean Blue" },
    { id: "forest", name: "Forest Green" },
    { id: "modern", name: "Modern Minimal" },
    { id: "luxury", name: "Luxury Estate" }
  ];

  const themesToDisplay = predefinedThemes.length > 0 ? predefinedThemes : fallbackThemes;

  return (
    <ThemeProvider initialThemeId={selectedThemeId}>
      <div className="min-h-screen">
        <div className="w-full p-4 bg-gray-100 border-b">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold mb-4">
              Theme Component Test Page
            </h1>
            <p className="mb-4">
              Current theme: <strong>{predefinedThemes.find(t => t.id === selectedThemeId)?.name}</strong>
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {themesToDisplay.map((theme) => (
                <Button
                  key={theme.id}
                  variant={selectedThemeId === theme.id ? "default" : "outline"}
                  onClick={() => setSelectedThemeId(theme.id)}
                >
                  {theme.name}
                </Button>
              ))}
            </div>
            <div className="mb-4 p-4 bg-yellow-100 rounded border border-yellow-300">
              <p className="text-sm font-bold">Debug info:</p>
              <p className="text-xs">Selected theme ID: {selectedThemeId}</p>
              <p className="text-xs">Available themes: {JSON.stringify(themesToDisplay.map(t => t.id))}</p>
            </div>
          </div>
        </div>

        <div className="theme-content container mx-auto p-4 space-y-8">
          {/* Button Examples */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button variant="default">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="link">Link Button</Button>
              <Button variant="destructive">Destructive Button</Button>
            </CardContent>
          </Card>

          {/* Form Elements */}
          <Card>
            <CardHeader>
              <CardTitle>Form Elements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Text Input</label>
                <Input type="text" placeholder="Enter text here" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Select</label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Textarea</label>
                <Textarea placeholder="Enter detailed text here" />
              </div>
            </CardContent>
          </Card>

          {/* Card Examples */}
          <Card>
            <CardHeader>
              <CardTitle>Card Component</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This is an example card with themed styling. The theme system should apply consistent colors and styling across all components.</p>
            </CardContent>
            <CardFooter>
              <Button>Card Action</Button>
            </CardFooter>
          </Card>

          {/* Color Palette Display */}
          <Card>
            <CardHeader>
              <CardTitle>Theme Colors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="h-20 bg-primary rounded"></div>
                  <p className="text-sm mt-2">Primary</p>
                </div>
                <div>
                  <div className="h-20 bg-secondary rounded"></div>
                  <p className="text-sm mt-2">Secondary</p>
                </div>
                <div>
                  <div className="h-20 bg-accent rounded"></div>
                  <p className="text-sm mt-2">Accent</p>
                </div>
                <div>
                  <div className="h-20 bg-muted rounded"></div>
                  <p className="text-sm mt-2">Muted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ThemeProvider>
  );
}
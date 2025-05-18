"use client";

import { useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";

export default function SimpleThemeTest() {
  const [currentTheme, setCurrentTheme] = useState("airbnb");
  
  console.log("SimpleThemeTest component rendering");
  
  return (
    <ThemeProvider initialThemeId={currentTheme}>
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold mb-6">Simple Theme Test</h1>
        
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Select Theme:</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-4 py-2 rounded-md ${currentTheme === 'airbnb' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setCurrentTheme('airbnb')}
            >
              Airbnb
            </button>
            <button 
              className={`px-4 py-2 rounded-md ${currentTheme === 'ocean' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setCurrentTheme('ocean')}
            >
              Ocean
            </button>
            <button 
              className={`px-4 py-2 rounded-md ${currentTheme === 'forest' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setCurrentTheme('forest')}
            >
              Forest
            </button>
            <button 
              className={`px-4 py-2 rounded-md ${currentTheme === 'modern' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setCurrentTheme('modern')}
            >
              Modern
            </button>
            <button 
              className={`px-4 py-2 rounded-md ${currentTheme === 'luxury' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
              onClick={() => setCurrentTheme('luxury')}
            >
              Luxury
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Theme Test Elements */}
          <div className="p-6 bg-card rounded-card border shadow-sm">
            <h3 className="text-xl font-semibold mb-4">Card Test</h3>
            <p className="mb-4">This card uses theme variables for styling</p>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-primary text-white rounded-button">
                Primary Button
              </button>
              <button className="px-4 py-2 bg-secondary rounded-button">
                Secondary Button
              </button>
            </div>
          </div>
          
          <div className="p-6 bg-card rounded-card border shadow-sm">
            <h3 className="text-xl font-semibold mb-4">Form Elements</h3>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Theme-styled input" 
                className="w-full p-input border rounded-input" 
              />
              <textarea 
                placeholder="Theme-styled textarea" 
                className="w-full p-input border rounded-input"
                rows={3}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-yellow-100 rounded border">
          <p><strong>Current Theme:</strong> {currentTheme}</p>
          <p><strong>Debug:</strong> Check browser console for logs</p>
        </div>
      </div>
    </ThemeProvider>
  );
}
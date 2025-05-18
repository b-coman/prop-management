"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { cn } from "@/lib/utils";

const languages = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' }
];

interface LanguageSelectorProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function LanguageSelector({ 
  className,
  variant = 'ghost',
  size = 'sm',
  showLabel = true
}: LanguageSelectorProps) {
  const { currentLang, switchLanguage } = useLanguage();
  const currentLanguage = languages.find(lang => lang.code === currentLang);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size} 
          className={cn("gap-2", className)}
        >
          <Globe className="h-4 w-4" />
          {showLabel && (
            <>
              <span className="hidden sm:inline">
                {currentLanguage?.flag} {currentLanguage?.name}
              </span>
              <span className="sm:hidden">{currentLanguage?.flag}</span>
            </>
          )}
          {!showLabel && currentLanguage?.flag}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => switchLanguage(lang.code)}
            className={cn(
              "cursor-pointer justify-between",
              currentLang === lang.code && "bg-accent"
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{lang.flag}</span>
              <span>{lang.name}</span>
            </span>
            {currentLang === lang.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Mobile-optimized version
export function MobileLanguageSelector() {
  const { currentLang, switchLanguage } = useLanguage();
  const currentLanguage = languages.find(lang => lang.code === currentLang);
  
  return (
    <div className="flex items-center gap-2">
      <Globe className="h-5 w-5 text-muted-foreground" />
      <select
        value={currentLang}
        onChange={(e) => switchLanguage(e.target.value)}
        className="bg-transparent border-none outline-none text-sm font-medium"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
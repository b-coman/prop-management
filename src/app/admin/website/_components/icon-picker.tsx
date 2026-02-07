'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Home, Building, Building2, Castle, Tent, TreePine, Trees, Mountain, TreePalm, Warehouse,
  Bed, BedDouble, Bath, Sofa, Lamp, Tv, DoorOpen, DoorClosed,
  ChefHat, CookingPot, UtensilsCrossed, Coffee, Wine, GlassWater,
  Wifi, Car, ParkingSquare, Dumbbell,
  Flower, Sun, Cloud, Snowflake, Wind, Sunrise, Sunset,
  Bike, Camera, Book, Music, Gamepad2,
  Bus, Train, Plane, Ship,
  Sparkles, Flame, Thermometer, Fan, AirVent, Zap, Droplets, ShowerHead,
  Star, Heart, Award, Crown, Check, Shield, Clock, Calendar, MapPin, Navigation, Compass,
  Users, Baby, Dog, Cat,
  CigaretteOff, Phone, Mail, Globe, Key, Lock, Briefcase, Package,
  MountainSnow, type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home, building: Building, 'building-2': Building2, castle: Castle,
  tent: Tent, 'tree-pine': TreePine, trees: Trees, mountain: Mountain,
  'mountain-snow': MountainSnow, 'tree-palm': TreePalm, warehouse: Warehouse,
  bed: Bed, 'bed-double': BedDouble, bath: Bath, sofa: Sofa, lamp: Lamp,
  tv: Tv, 'door-open': DoorOpen, 'door-closed': DoorClosed,
  'chef-hat': ChefHat, 'cooking-pot': CookingPot, 'utensils-crossed': UtensilsCrossed,
  coffee: Coffee, wine: Wine, 'glass-water': GlassWater,
  wifi: Wifi, car: Car, 'parking-square': ParkingSquare, dumbbell: Dumbbell,
  flower: Flower, sun: Sun, cloud: Cloud, snowflake: Snowflake, wind: Wind,
  sunrise: Sunrise, sunset: Sunset,
  bike: Bike, camera: Camera, book: Book, music: Music, 'gamepad-2': Gamepad2,
  bus: Bus, train: Train, plane: Plane, ship: Ship,
  sparkles: Sparkles, flame: Flame, thermometer: Thermometer, fan: Fan,
  'air-vent': AirVent, zap: Zap, droplets: Droplets, 'shower-head': ShowerHead,
  star: Star, heart: Heart, award: Award, crown: Crown, check: Check,
  shield: Shield, clock: Clock, calendar: Calendar, 'map-pin': MapPin,
  navigation: Navigation, compass: Compass,
  users: Users, baby: Baby, dog: Dog, cat: Cat,
  'cigarette-off': CigaretteOff, phone: Phone, mail: Mail, globe: Globe,
  key: Key, lock: Lock, briefcase: Briefcase, package: Package,
};

const ICON_NAMES = Object.keys(ICON_MAP);

interface IconPickerProps {
  value?: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = useMemo(() => {
    if (!search) return ICON_NAMES;
    const q = search.toLowerCase();
    return ICON_NAMES.filter((name) => name.includes(q));
  }, [search]);

  const CurrentIcon = value ? ICON_MAP[value] : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9 min-w-[120px] justify-start">
          {CurrentIcon ? (
            <>
              <CurrentIcon className="h-4 w-4" />
              <span className="text-xs truncate">{value}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Pick icon...</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-xs mb-2"
        />
        <div className="grid grid-cols-6 gap-1 max-h-[240px] overflow-y-auto">
          {filteredIcons.map((name) => {
            const Icon = ICON_MAP[name];
            return (
              <button
                key={name}
                type="button"
                onClick={() => { onChange(name); setOpen(false); setSearch(''); }}
                title={name}
                className={`flex items-center justify-center h-10 w-10 rounded-md transition-colors ${
                  value === name
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
              </button>
            );
          })}
          {filteredIcons.length === 0 && (
            <p className="col-span-6 text-center text-xs text-muted-foreground py-4">No icons match &ldquo;{search}&rdquo;</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Render a named icon inline (for previews outside the picker). Returns null if name is unknown. */
export function IconPreview({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className || 'h-4 w-4'} />;
}

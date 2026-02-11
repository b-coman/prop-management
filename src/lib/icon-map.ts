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
  Leaf, Map,
  MountainSnow, type LucideIcon,
} from 'lucide-react';

/** Shared icon map (kebab-case name → Lucide component). Used by admin IconPicker and frontend rendering. */
export const ICON_MAP: Record<string, LucideIcon> = {
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
  leaf: Leaf, map: Map,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

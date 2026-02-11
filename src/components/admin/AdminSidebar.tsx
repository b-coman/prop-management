// src/components/admin/AdminSidebar.tsx
// Admin sidebar navigation component

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building,
  Building2,
  CalendarCheck,
  Ticket,
  MessageSquare,
  Sliders,
  RefreshCw,
  LogOut,
  ChevronRight,
  Loader2,
  Star,
  BarChart3,
  Users,
  Sparkles,
  DollarSign,
  FileText,
  PanelTop,
  Settings,
} from 'lucide-react';
import { useAuth } from '@/contexts/SimpleAuthContext';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';

function getDisplayName(name: string | { en?: string; ro?: string }): string {
  if (typeof name === 'string') return name;
  return name.en || name.ro || 'Unnamed';
}

// Navigation items grouped by section
const navigationGroups = [
  {
    label: 'Properties',
    items: [
      { title: 'Properties', href: '/admin/properties', icon: Building },
      { title: 'Pricing', href: '/admin/pricing', icon: Sliders },
      { title: 'Calendar', href: '/admin/calendar', icon: RefreshCw },
    ],
  },
  {
    label: 'Website',
    items: [
      { title: 'Pages & Content', href: '/admin/website', icon: FileText },
      { title: 'Navigation & Info', href: '/admin/website/navigation', icon: PanelTop },
      { title: 'Settings', href: '/admin/website/settings', icon: Settings },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Bookings', href: '/admin/bookings', icon: CalendarCheck },
      { title: 'Inquiries', href: '/admin/inquiries', icon: MessageSquare },
      { title: 'Guests', href: '/admin/guests', icon: Users },
      { title: 'Reviews', href: '/admin/reviews', icon: Star },
      { title: 'Housekeeping', href: '/admin/housekeeping', icon: Sparkles },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { title: 'Revenue', href: '/admin/revenue', icon: DollarSign },
      { title: 'Attribution', href: '/admin/attribution', icon: BarChart3 },
      { title: 'Coupons', href: '/admin/coupons', icon: Ticket },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const { properties, selectedPropertyId, setSelectedProperty, isPending } = usePropertySelector();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Collect all nav hrefs for most-specific-match logic
  const allHrefs = navigationGroups.flatMap((g) => g.items.map((i) => i.href));

  const isActive = (href: string) => {
    if (!pathname.startsWith(href)) return false;
    // If another href is a more specific match, this one shouldn't be active
    // e.g. /admin/website should NOT match when /admin/website/navigation does
    return !allHrefs.some(
      (other) => other !== href && other.startsWith(href) && pathname.startsWith(other)
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-sidebar-accent rounded-md transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm">RentalSpot Admin</span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Property Selector */}
        <SidebarGroup>
          <SidebarGroupLabel>
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Property
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {!isCollapsed ? (
              <div className="px-2 pb-1">
                <Select
                  value={selectedPropertyId || 'all'}
                  onValueChange={(v) => setSelectedProperty(v === 'all' ? null : v)}
                  disabled={isPending}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    {isPending ? (
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-muted-foreground">Loading...</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select property" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {getDisplayName(p.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={
                      isPending
                        ? 'Loading...'
                        : selectedPropertyId
                          ? getDisplayName(properties.find(p => p.id === selectedPropertyId)?.name || 'Unknown')
                          : 'All Properties'
                    }
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dashboard link */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/admin'}
                  tooltip="Dashboard"
                >
                  <Link href="/admin">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                    {pathname === '/admin' && (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navigationGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.title}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {isActive(item.href) && (
                          <ChevronRight className="ml-auto h-4 w-4" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        {user && !isCollapsed && (
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

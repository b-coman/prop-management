// src/components/admin/AdminSidebar.tsx
// Admin sidebar navigation component

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building,
  CalendarCheck,
  Ticket,
  MessageSquare,
  Sliders,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/SimpleAuthContext';
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
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// Navigation items configuration
const navigationItems = [
  {
    title: 'Properties',
    href: '/admin/properties',
    icon: Building,
  },
  {
    title: 'Pricing',
    href: '/admin/pricing',
    icon: Sliders,
  },
  {
    title: 'Bookings',
    href: '/admin/bookings',
    icon: CalendarCheck,
  },
  {
    title: 'Coupons',
    href: '/admin/coupons',
    icon: Ticket,
  },
  {
    title: 'Inquiries',
    href: '/admin/inquiries',
    icon: MessageSquare,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const isActive = (href: string) => pathname.startsWith(href);

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
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
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

// src/app/admin/page.tsx
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Ticket, Users, Settings, BarChart3, HelpCircle, Building, PlusCircle } from 'lucide-react'; // Added Building, PlusCircle

export default function AdminDashboardPage() {
  return (
    <div className="container mx-auto py-10">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center">Welcome to RentalSpot Admin</CardTitle>
          <CardDescription className="text-xl text-muted-foreground text-center mt-2">
            Manage your properties, bookings, and settings with ease.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            This is your central hub for overseeing all aspects of your rental business.
            Use the navigation links above or the quick access sections below to get started.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

         {/* Property Management Card */}
         <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Building className="mr-2 h-6 w-6 text-primary" />
              Property Management
            </CardTitle>
            <CardDescription>
              Add, edit, and manage your rental property listings.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
            <Link href="/admin/properties" passHref>
              <Button variant="outline" className="w-full">View All Properties</Button>
            </Link>
             <Link href="/admin/properties/new" passHref>
               <Button className="w-full">
                 <PlusCircle className="mr-2 h-4 w-4" /> Add New Property
               </Button>
             </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Ticket className="mr-2 h-6 w-6 text-primary" />
              Coupon Management
            </CardTitle>
            <CardDescription>
              Create, view, and manage discount coupons for your properties.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
            <Link href="/admin/coupons" passHref>
              <Button variant="outline" className="w-full">View All Coupons</Button>
            </Link>
            <Link href="/admin/coupons/new" passHref>
              <Button className="w-full">Create New Coupon</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Removed Placeholder Property Management Card */}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Users className="mr-2 h-6 w-6 text-primary" />
              User Management (Future)
            </CardTitle>
            <CardDescription>
              View and manage user accounts and roles. (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Manage Users</Button>
          </CardContent>
        </Card>

         <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <BarChart3 className="mr-2 h-6 w-6 text-primary" />
              Analytics & Reports (Future)
            </CardTitle>
            <CardDescription>
              View booking statistics and performance reports. (Coming Soon)
            </CardHeader>
          </CardContent>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>View Analytics</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Settings className="mr-2 h-6 w-6 text-primary" />
              System Settings (Future)
            </CardTitle>
            <CardDescription>
              Configure global settings for your rental platform. (Coming Soon)
            </CardHeader>
          </CardContent>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>Configure Settings</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <HelpCircle className="mr-2 h-6 w-6 text-primary" />
              Help & Documentation
            </CardTitle>
            <CardDescription>
              Find guides and tutorials on how to use the admin panel effectively.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Link to your DOCUMENTATION.md or a future dedicated help section */}
            <Link href="/DOCUMENTATION.md" target="_blank" passHref>
              <Button variant="outline" className="w-full">View Documentation</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
            <CardTitle className="text-xl">Quick Start Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-muted-foreground">
             <p><strong>1. Add Properties:</strong> Use the "Property Management" section to add your rental listings.</p>
            <p><strong>2. Manage Coupons:</strong> Use the "Coupon Management" section to create discounts that guests can apply during booking.</p>
            <p><strong>3. Monitor Bookings:</strong> (Future) Keep an eye on incoming bookings and their statuses.</p>
            <p><strong>4. Customize Property Websites:</strong> (Future) Tailor the content and appearance of individual property websites through overrides.</p>
             <p><strong>Need Help?</strong> Refer to the documentation or contact support if you encounter any issues.</p>
        </CardContent>
      </Card>
    </div>
  );
}

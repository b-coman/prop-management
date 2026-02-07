'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ThemeSelector } from '@/components/ui/theme-selector';
import { useToast } from '@/hooks/use-toast';
import { updateWebsiteSettings, type WebsiteSettings } from '../actions';

interface WebsiteSettingsFormProps {
  propertyId: string;
  initialSettings: WebsiteSettings;
}

export function WebsiteSettingsForm({ propertyId, initialSettings }: WebsiteSettingsFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<WebsiteSettings>(initialSettings);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateWebsiteSettings(propertyId, settings);
    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({ title: 'Settings saved', description: 'Website settings have been updated.' });
    }
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>Website Theme</CardTitle>
          <CardDescription>Choose a design theme for your property website</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector
            selectedThemeId={settings.themeId || ''}
            onThemeChange={(id) => setSettings((s) => ({ ...s, themeId: id }))}
          />
        </CardContent>
      </Card>

      {/* Template (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Website Template</CardTitle>
          <CardDescription>The template determines the structure and layout of your property pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input value={settings.templateId || 'holiday-house'} disabled className="max-w-sm" />
            <span className="text-sm text-muted-foreground">Currently fixed</span>
          </div>
        </CardContent>
      </Card>

      {/* Domain */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Configuration</CardTitle>
          <CardDescription>Configure a custom domain for your property website</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Custom Domain</Label>
            <Input
              placeholder="e.g., your-property.com (without https://)"
              value={settings.customDomain || ''}
              onChange={(e) => setSettings((s) => ({ ...s, customDomain: e.target.value || null }))}
              className="max-w-md"
            />
            <p className="text-sm text-muted-foreground">Assign a custom domain (requires DNS setup).</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Use Custom Domain</Label>
              <p className="text-sm text-muted-foreground">Enable routing via the custom domain.</p>
            </div>
            <Switch
              checked={settings.useCustomDomain || false}
              onCheckedChange={(checked) => setSettings((s) => ({ ...s, useCustomDomain: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
          <CardDescription>Track visits and integrate with Google services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Google Analytics</Label>
              <p className="text-sm text-muted-foreground">Track visits using Google Analytics.</p>
            </div>
            <Switch
              checked={settings.analytics?.enabled || false}
              onCheckedChange={(checked) =>
                setSettings((s) => ({
                  ...s,
                  analytics: { ...s.analytics, enabled: checked, googleAnalyticsId: s.analytics?.googleAnalyticsId || '' },
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Google Analytics ID</Label>
            <Input
              placeholder="e.g., G-XXXXXXXXXX"
              value={settings.analytics?.googleAnalyticsId || ''}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  analytics: { ...s.analytics, enabled: s.analytics?.enabled || false, googleAnalyticsId: e.target.value },
                }))
              }
              className="max-w-sm"
            />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Google Place ID</Label>
            <Input
              placeholder="e.g., ChIJ..."
              value={settings.googlePlaceId || ''}
              onChange={(e) => setSettings((s) => ({ ...s, googlePlaceId: e.target.value }))}
              className="max-w-sm"
            />
            <p className="text-sm text-muted-foreground">Google Places ID for syncing Google Reviews.</p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

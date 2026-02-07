'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, Plus, Check, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { updateLengthOfStayDiscounts } from '../server-actions-hybrid';
import type { LengthOfStayDiscount } from '@/lib/pricing/pricing-schemas';

interface LengthOfStayDiscountsProps {
  discounts: LengthOfStayDiscount[];
  propertyId: string;
}

export function LengthOfStayDiscounts({ discounts: initialDiscounts, propertyId }: LengthOfStayDiscountsProps) {
  const router = useRouter();
  const [discounts, setDiscounts] = useState<LengthOfStayDiscount[]>(initialDiscounts);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editNights, setEditNights] = useState('');
  const [editPercentage, setEditPercentage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const saveDiscounts = async (updated: LengthOfStayDiscount[]) => {
    setIsSaving(true);
    setError(null);
    try {
      const result = await updateLengthOfStayDiscounts(propertyId, updated);
      if (result.success) {
        // Sort locally to match server sort
        const sorted = [...updated].sort((a, b) => a.nightsThreshold - b.nightsThreshold);
        setDiscounts(sorted);
        router.refresh();
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save discounts');
    } finally {
      setIsSaving(false);
    }
  };

  const validate = (nights: string, percentage: string, excludeIndex?: number): string | null => {
    const n = parseInt(nights, 10);
    const p = parseFloat(percentage);

    if (isNaN(n) || n < 2) return 'Minimum nights must be at least 2';
    if (isNaN(p) || p < 0.1 || p > 100) return 'Discount must be between 0.1% and 100%';

    const duplicate = discounts.some((d, i) => i !== excludeIndex && d.nightsThreshold === n);
    if (duplicate) return `A discount for ${n}+ nights already exists`;

    return null;
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditNights('');
    setEditPercentage('');
    setEditingIndex(null);
    setError(null);
  };

  const handleSaveNew = () => {
    const validationError = validate(editNights, editPercentage);
    if (validationError) {
      setError(validationError);
      return;
    }

    const newDiscount: LengthOfStayDiscount = {
      nightsThreshold: parseInt(editNights, 10),
      discountPercentage: parseFloat(editPercentage),
      enabled: true
    };

    saveDiscounts([...discounts, newDiscount]);
    setIsAdding(false);
  };

  const handleEdit = (index: number) => {
    const d = discounts[index];
    setEditingIndex(index);
    setEditNights(d.nightsThreshold.toString());
    setEditPercentage(d.discountPercentage.toString());
    setIsAdding(false);
    setError(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null) return;

    const validationError = validate(editNights, editPercentage, editingIndex);
    if (validationError) {
      setError(validationError);
      return;
    }

    const updated = [...discounts];
    updated[editingIndex] = {
      ...updated[editingIndex],
      nightsThreshold: parseInt(editNights, 10),
      discountPercentage: parseFloat(editPercentage)
    };

    saveDiscounts(updated);
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
    setError(null);
  };

  const handleDelete = (index: number) => {
    const updated = discounts.filter((_, i) => i !== index);
    saveDiscounts(updated);
  };

  const handleToggle = (index: number, enabled: boolean) => {
    const updated = [...discounts];
    updated[index] = { ...updated[index], enabled };
    saveDiscounts(updated);
  };

  if (discounts.length === 0 && !isAdding) {
    return (
      <div className="text-center py-6">
        <p className="text-muted-foreground">No length-of-stay discounts defined for this property.</p>
        <Button className="mt-4" onClick={handleAdd} disabled={isSaving}>
          Add Your First Discount
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <Table>
        <TableCaption>Length-of-stay discount tiers for this property.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Minimum Nights</TableHead>
            <TableHead>Discount %</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {discounts.map((discount, index) => (
            <TableRow key={index}>
              {editingIndex === index ? (
                <>
                  <TableCell>
                    <Input
                      type="number"
                      min={2}
                      value={editNights}
                      onChange={(e) => setEditNights(e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0.1}
                      max={100}
                      step={0.1}
                      value={editPercentage}
                      onChange={(e) => setEditPercentage(e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={discount.enabled ? 'default' : 'secondary'}>
                      {discount.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="icon" onClick={handleSaveEdit} disabled={isSaving}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleCancel}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="font-medium">{discount.nightsThreshold}+ nights</TableCell>
                  <TableCell>{discount.discountPercentage}%</TableCell>
                  <TableCell>
                    <Switch
                      checked={discount.enabled}
                      disabled={isSaving}
                      onCheckedChange={(checked) => handleToggle(index, checked)}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleEdit(index)}
                        disabled={isSaving || isAdding}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" disabled={isSaving}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Discount</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete the {discount.nightsThreshold}+ nights discount? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(index)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}

          {isAdding && (
            <TableRow>
              <TableCell>
                <Input
                  type="number"
                  min={2}
                  placeholder="e.g. 7"
                  value={editNights}
                  onChange={(e) => setEditNights(e.target.value)}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  placeholder="e.g. 5"
                  value={editPercentage}
                  onChange={(e) => setEditPercentage(e.target.value)}
                  className="w-24"
                />
              </TableCell>
              <TableCell>
                <Badge variant="default">Active</Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="icon" onClick={handleSaveNew} disabled={isSaving}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {!isAdding && editingIndex === null && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={handleAdd} disabled={isSaving}>
            <Plus className="mr-2 h-4 w-4" />
            Add Discount Tier
          </Button>
        </div>
      )}
    </div>
  );
}

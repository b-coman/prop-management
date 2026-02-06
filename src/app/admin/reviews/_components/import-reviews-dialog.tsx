'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropertySelector } from '@/contexts/PropertySelectorContext';
import { parseCsvReviews, generateCsvTemplate, type ParsedReviewRow, type CsvParseError } from '@/lib/csv-review-parser';
import { checkDuplicateReviews, importReviewsBatch } from '../actions';

type Step = 'input' | 'preview' | 'done';

interface PreviewRow {
  review: ParsedReviewRow;
  selected: boolean;
  status: 'ok' | 'duplicate';
}

interface ImportReviewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportReviewsDialog({ open, onOpenChange }: ImportReviewsDialogProps) {
  const { properties } = usePropertySelector();
  const [step, setStep] = useState<Step>('input');
  const [propertyId, setPropertyId] = useState<string>('');
  const [csvText, setCsvText] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [parseErrors, setParseErrors] = useState<CsvParseError[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('input');
    setPropertyId('');
    setCsvText('');
    setPreviewRows([]);
    setParseErrors([]);
    setTotalRows(0);
    setPublishImmediately(true);
    setIsLoading(false);
    setImportCount(0);
    setImportError('');
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  }, [onOpenChange, reset]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string || '');
    };
    reader.readAsText(file);
    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    const csv = generateCsvTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'review-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleParseAndPreview = async () => {
    if (!propertyId) return;
    if (!csvText.trim()) return;

    setIsLoading(true);
    try {
      const result = parseCsvReviews(csvText);
      setParseErrors(result.errors);
      setTotalRows(result.totalRows);

      if (result.reviews.length === 0) {
        setIsLoading(false);
        return;
      }

      // Check duplicates
      const dupResult = await checkDuplicateReviews(
        result.reviews.map(r => ({
          propertyId,
          guestName: r.guestName,
          date: r.date,
          source: r.source,
        }))
      );

      const dupSet = new Set(dupResult.duplicateIndices);
      const rows: PreviewRow[] = result.reviews.map((review, i) => ({
        review,
        selected: !dupSet.has(i),
        status: dupSet.has(i) ? 'duplicate' as const : 'ok' as const,
      }));

      setPreviewRows(rows);
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRow = (index: number) => {
    setPreviewRows(prev => prev.map((r, i) => i === index ? { ...r, selected: !r.selected } : r));
  };

  const toggleAll = () => {
    const allSelected = previewRows.every(r => r.selected);
    setPreviewRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const selectedCount = previewRows.filter(r => r.selected).length;
  const duplicateCount = previewRows.filter(r => r.status === 'duplicate').length;

  const handleImport = async () => {
    const selected = previewRows.filter(r => r.selected);
    if (selected.length === 0) return;

    setIsLoading(true);
    setImportError('');
    try {
      const result = await importReviewsBatch({
        reviews: selected.map(r => ({
          propertyId,
          guestName: r.review.guestName,
          rating: r.review.rating,
          comment: r.review.comment,
          date: r.review.date,
          source: r.review.source,
          sourceUrl: r.review.sourceUrl,
          language: r.review.language,
          isPublished: publishImmediately,
        })),
      });

      if (result.success) {
        setImportCount(result.count);
        setStep('done');
      } else {
        setImportError(result.error || 'Import failed.');
      }
    } catch {
      setImportError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Reviews</DialogTitle>
          <DialogDescription>Upload a CSV file or paste CSV data to bulk import reviews.</DialogDescription>
        </DialogHeader>

        {step === 'input' && (
          <div className="space-y-4">
            {/* Property selector */}
            <div className="space-y-2">
              <Label>Property *</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {typeof p.name === 'string' ? p.name : p.name.en || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CSV input */}
            <Tabs defaultValue="paste">
              <TabsList>
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste CSV</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-dashed"
                >
                  <Upload className="h-5 w-5 mr-2" />
                  Choose CSV file
                </Button>
                {csvText && (
                  <p className="text-sm text-muted-foreground">
                    File loaded ({csvText.split('\n').filter(l => l.trim()).length - 1} data rows detected)
                  </p>
                )}
              </TabsContent>
              <TabsContent value="paste" className="space-y-3">
                <Textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={`guestName,rating,comment,date,source\n"John Smith",5,"Great stay!",2025-06-15,direct`}
                  rows={8}
                  className="font-mono text-xs"
                />
              </TabsContent>
            </Tabs>

            {/* Parse errors from empty parse */}
            {parseErrors.length > 0 && previewRows.length === 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {parseErrors.length === 1 && parseErrors[0].row === 0
                    ? parseErrors[0].message
                    : `${parseErrors.length} error(s) found. Fix the CSV and try again.`}
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Download Template
              </Button>
              <Button
                type="button"
                onClick={handleParseAndPreview}
                disabled={!propertyId || !csvText.trim() || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Parse &amp; Preview
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Stats */}
            <Alert>
              <AlertDescription>
                Parsed {previewRows.length} review(s) from {totalRows} row(s).
                {parseErrors.length > 0 && ` ${parseErrors.length} row(s) had errors.`}
                {duplicateCount > 0 && ` ${duplicateCount} duplicate(s) detected.`}
              </AlertDescription>
            </Alert>

            {/* Error details */}
            {parseErrors.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-destructive font-medium">
                  {parseErrors.length} parse error(s)
                </summary>
                <ul className="mt-1 space-y-1 text-muted-foreground text-xs">
                  {parseErrors.slice(0, 20).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.field} - {e.message}</li>
                  ))}
                  {parseErrors.length > 20 && <li>...and {parseErrors.length - 20} more</li>}
                </ul>
              </details>
            )}

            {/* Preview table */}
            <div className="border rounded-md overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-8">
                      <Checkbox
                        checked={previewRows.length > 0 && previewRows.every(r => r.selected)}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="p-2 text-left">Guest Name</th>
                    <th className="p-2 text-left w-16">Rating</th>
                    <th className="p-2 text-left">Comment</th>
                    <th className="p-2 text-left w-24">Date</th>
                    <th className="p-2 text-left w-24">Source</th>
                    <th className="p-2 text-left w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr
                      key={i}
                      className={row.status === 'duplicate' ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={() => toggleRow(i)}
                        />
                      </td>
                      <td className="p-2 max-w-[150px] truncate">{row.review.guestName}</td>
                      <td className="p-2">{row.review.rating}/5</td>
                      <td className="p-2 max-w-[250px] truncate">{row.review.comment.slice(0, 80)}{row.review.comment.length > 80 ? '...' : ''}</td>
                      <td className="p-2 text-xs">{new Date(row.review.date).toLocaleDateString()}</td>
                      <td className="p-2 text-xs">{row.review.source}</td>
                      <td className="p-2">
                        {row.status === 'ok' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3 w-3" /> OK</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><AlertTriangle className="h-3 w-3" /> Duplicate</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Publish switch */}
            <div className="flex items-center gap-2">
              <Switch checked={publishImmediately} onCheckedChange={setPublishImmediately} id="publish-switch" />
              <Label htmlFor="publish-switch">Publish immediately</Label>
            </div>

            {importError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep('input')}>Back</Button>
              <Button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0 || isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Import {selectedCount} Selected
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-lg font-medium">Successfully imported {importCount} review(s)</p>
            <Button type="button" onClick={() => handleOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

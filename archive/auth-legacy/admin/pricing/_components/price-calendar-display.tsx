'use client';

import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarIcon, ChevronLeft, ChevronRight, PencilIcon } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { updateDay } from '../server-actions-hybrid';
import { EditDayDialog } from './edit-day-dialog';
import { useToast } from '@/hooks/use-toast';

interface PriceCalendarDisplayProps {
  priceCalendars: any[];
}

export function PriceCalendarDisplay({ priceCalendars: initialCalendars }: PriceCalendarDisplayProps) {
  // Store the calendars in local state so we can update them
  const [calendars, setCalendars] = useState<any[]>(initialCalendars);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>(
    calendars.length > 0 ? calendars[0].id : ''
  );
  const [guestCount, setGuestCount] = useState<string>('2');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [editingDay, setEditingDay] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();

  // Get the selected calendar
  const selectedCalendar = calendars.find(calendar => calendar.id === selectedCalendarId);

  // Handle opening the edit dialog
  const handleEditDay = (dayNumber: number, dayData: any) => {
    // Ensure day number is a valid integer
    const validDayNumber = parseInt(String(dayNumber), 10);

    console.log('Calendar data:', {
      year: selectedCalendar.year,
      month: selectedCalendar.month,
      monthStr: selectedCalendar.monthStr,
      dayNumber: validDayNumber
    });

    // Format the date string correctly
    const dateStr = `${selectedCalendar.year}-${selectedCalendar.month.toString().padStart(2, '0')}-${validDayNumber.toString().padStart(2, '0')}`;
    console.log('Generated date string:', dateStr);

    setEditingDay({
      ...dayData,
      dayNumber: validDayNumber,
      dateStr
    });
    setIsEditDialogOpen(true);
  };

  // Handle updating a day
  const handleUpdateDay = async (dayData: any) => {
    try {
      const result = await updateDay(dayData);

      if (result.success) {
        toast({
          title: "Day updated",
          description: `The changes for ${dayData.date} have been saved.`,
        });

        // Update the local calendar data
        if (selectedCalendar) {
          // Extract day number from the date string (the third part after splitting by dash)
          const dayNumber = parseInt(dayData.date.split('-')[2], 10).toString();

          // Create a deep copy of the selected calendar
          const updatedCalendar = JSON.parse(JSON.stringify(selectedCalendar));

          // Update the specific day in our local data
          if (updatedCalendar.days[dayNumber]) {
            // Update the day's properties
            updatedCalendar.days[dayNumber] = {
              ...updatedCalendar.days[dayNumber],
              adjustedPrice: dayData.customPrice,
              available: dayData.available,
              minimumStay: dayData.minimumStay,
              reason: dayData.reason || updatedCalendar.days[dayNumber].reason,
              priceSource: 'override',
              overrideId: dayData.id
            };

            // Update the prices for different guest counts
            if (updatedCalendar.days[dayNumber].prices) {
              for (const guestCount in updatedCalendar.days[dayNumber].prices) {
                updatedCalendar.days[dayNumber].prices[guestCount] = dayData.customPrice;
              }
            }

            // Update the state to trigger a re-render
            const updatedCalendars = calendars.map(cal =>
              cal.id === selectedCalendarId ? updatedCalendar : cal
            );

            // Update the state with the modified calendar
            setCalendars(updatedCalendars);
          }
        }

        // Close the dialog
        setIsEditDialogOpen(false);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update day",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating day:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  // Navigation functions
  const goToPreviousMonth = () => {
    const prevMonth = addMonths(currentDate, -1);
    setCurrentDate(prevMonth);

    // Try to find a calendar for this month
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1; // 1-based month

    const calendar = calendars.find(cal => cal.year === year && cal.month === month);
    if (calendar) {
      setSelectedCalendarId(calendar.id);
    }
  };

  const goToNextMonth = () => {
    const nextMonth = addMonths(currentDate, 1);
    setCurrentDate(nextMonth);

    // Try to find a calendar for this month
    const year = nextMonth.getFullYear();
    const month = nextMonth.getMonth() + 1; // 1-based month

    const calendar = calendars.find(cal => cal.year === year && cal.month === month);
    if (calendar) {
      setSelectedCalendarId(calendar.id);
    }
  };
  
  // Get possible guest counts
  const getGuestCounts = () => {
    if (!selectedCalendar) return [];
    
    // Find the first day that has defined prices to determine possible guest counts
    const firstDay = Object.values(selectedCalendar.days)[0];
    if (!firstDay || !firstDay.prices) return [];
    
    return Object.keys(firstDay.prices);
  };

  // Generate color classes based on price range
  const getPriceColorClass = (price: number, minPrice: number, maxPrice: number) => {
    if (!minPrice || !maxPrice || minPrice === maxPrice) return 'bg-slate-50';
    
    const range = maxPrice - minPrice;
    const priceRatio = (price - minPrice) / range;
    
    if (priceRatio < 0.25) return 'bg-emerald-50 hover:bg-emerald-100';
    if (priceRatio < 0.5) return 'bg-blue-50 hover:bg-blue-100';
    if (priceRatio < 0.75) return 'bg-amber-50 hover:bg-amber-100';
    return 'bg-rose-50 hover:bg-rose-100';
  };

  // Render the calendar table
  const renderCalendarTable = () => {
    if (!selectedCalendar) return null;
    
    // Calculate calendar data
    const firstDayOfMonth = new Date(selectedCalendar.year, selectedCalendar.month - 1, 1).getDay(); // 0-6 (Sun-Sat)
    const daysInMonth = new Date(selectedCalendar.year, selectedCalendar.month, 0).getDate();
    
    // Create weeks array
    const weeks = [];
    let day = 1;
    
    // Loop through weeks - we need to ensure we display all days in the month,
    // but we don't want to exceed the number of days in the month
    for (let week = 0; week < 6 && day <= daysInMonth; week++) {
      const weekDays = [];
      
      // Loop through days in a week
      for (let weekday = 0; weekday < 7; weekday++) {
        if ((week === 0 && weekday < firstDayOfMonth) || day > daysInMonth) {
          // Empty cell
          weekDays.push(<td key={`empty-${week}-${weekday}`} className="p-1" style={{ height: '90px', width: '100px' }}>
            <div className="h-full w-full"></div>
          </td>);
        } else {
          // Make sure we're not exceeding days in month (shouldn't happen, but as a safety check)
          if (day > daysInMonth) {
            weekDays.push(<td key={`overflow-${week}-${weekday}`} className="p-1" style={{ height: '90px', width: '100px' }}>
              <div className="h-full w-full"></div>
            </td>);
            continue;
          }

          // Day cell
          const dayData = selectedCalendar.days[day.toString()];
          if (!dayData) {
            weekDays.push(
              <td key={`missing-${day}`} className="p-1" style={{ height: '90px', width: '100px' }}>
                <div className="p-1.5 border border-red-200 bg-red-50 rounded-lg w-full h-full flex flex-col">
                  <div className="text-sm font-bold text-red-700">{day}</div>
                  <div className="text-xs text-red-600">Missing</div>
                </div>
              </td>
            );
          } else {
            const dayPrice = dayData.prices?.[guestCount] || dayData.adjustedPrice;
            const priceClass = getPriceColorClass(
              dayPrice,
              selectedCalendar.summary.minPrice,
              selectedCalendar.summary.maxPrice
            );

            // Calculate specific styling
            const isUnavailable = !dayData.available;
            const isWeekend = weekday === 0 || weekday === 6;
            const hasSpecialPrice = dayData.priceSource !== 'base';

            // Get a safe copy of the current day value for the click handler
            const currentDay = day;

            weekDays.push(
              <td key={`day-${currentDay}`} className="p-1" style={{ height: '90px', width: '100px' }}>
                <div
                  className={`
                    p-1.5 h-full w-full border rounded-lg shadow-sm transition-all hover:shadow-md flex flex-col
                    ${priceClass}
                    ${isUnavailable ? 'opacity-60 bg-gray-100 border-gray-200' : 'border-slate-200'}
                    ${isWeekend ? 'border-l-rose-300 border-l-2' : ''}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <div className={`text-sm font-bold ${isWeekend ? 'text-rose-600' : 'text-slate-700'}`}>
                      {currentDay}
                    </div>
                    <div className="flex items-center space-x-1">
                      {hasSpecialPrice && (
                        <Badge
                          variant={dayData.priceSource === 'override' ? 'destructive' : 'secondary'}
                          className="text-[8px] px-1 py-0 rounded-full"
                        >
                          {dayData.priceSource === 'override' ? 'custom' : dayData.priceSource}
                        </Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Use the safely captured day number
                          handleEditDay(currentDay, dayData);
                        }}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                        title="Edit day"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className={`text-xs font-semibold ${isUnavailable ? 'line-through' : ''} mb-auto mt-0.5`}>
                    {formatPrice(dayPrice)}
                  </div>

                  <div className="mt-auto text-[10px]">
                    {dayData.minimumStay > 1 && (
                      <div className="text-slate-600">
                        Min: {dayData.minimumStay}n
                      </div>
                    )}

                    {isUnavailable && (
                      <div className="text-rose-600 font-medium">
                        Unavailable
                      </div>
                    )}
                  </div>
                </div>
              </td>
            );
          }
          day++;
        }
      }
      
      weeks.push(<tr key={`week-${week}`}>{weekDays}</tr>);
    }
    
    return (
      <div className="overflow-auto">
        <table className="w-full border-separate border-spacing-1" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
          </colgroup>
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <th
                  key={day}
                  className={`text-center font-semibold text-sm p-2 ${
                    index === 0 || index === 6 ? 'text-rose-600' : 'text-slate-600'
                  }`}
                  style={{ width: '100px' }}
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks}
          </tbody>
        </table>
      </div>
    );
  };

  if (calendars.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <p className="text-slate-500">
              No price calendars found. Generate price calendars to view them here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isEditDialogOpen && editingDay && selectedCalendar && (
        <EditDayDialog
          isOpen={isEditDialogOpen}
          onClose={() => setIsEditDialogOpen(false)}
          dayData={editingDay}
          dayNumber={parseInt(String(editingDay.dayNumber), 10)}
          monthStr={selectedCalendar.monthStr || ''}
          year={parseInt(String(selectedCalendar.year), 10)}
          month={parseInt(String(selectedCalendar.month), 10)}
          propertyId={selectedCalendar.propertyId}
          onUpdate={handleUpdateDay}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToPreviousMonth}
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1">
            <Select
              value={selectedCalendarId}
              onValueChange={setSelectedCalendarId}
            >
              <SelectTrigger className="w-[240px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {calendars.map(calendar => (
                  <SelectItem key={calendar.id} value={calendar.id}>
                    {calendar.monthStr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={goToNextMonth}
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Guest count:</span>
          <Select
            value={guestCount}
            onValueChange={setGuestCount}
          >
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder="Guests" />
            </SelectTrigger>
            <SelectContent>
              {getGuestCounts().map(count => (
                <SelectItem key={count} value={count}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCalendar && (
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle>{selectedCalendar.monthStr} Price Calendar</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {renderCalendarTable()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Calendar Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Price statistics */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-3">Price Statistics</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <SummaryCard 
                        title="Minimum Price" 
                        value={formatPrice(selectedCalendar.summary.minPrice)}
                        icon="💰"
                        color="emerald" 
                      />
                      <SummaryCard 
                        title="Maximum Price" 
                        value={formatPrice(selectedCalendar.summary.maxPrice)}
                        icon="💸"
                        color="rose" 
                      />
                      <SummaryCard 
                        title="Average Price" 
                        value={formatPrice(selectedCalendar.summary.avgPrice)}
                        icon="⚖️"
                        color="blue" 
                      />
                    </div>
                  </div>
                  
                  {/* Availability statistics */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-3">Availability & Modifications</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <SummaryCard 
                        title="Unavailable Days" 
                        value={selectedCalendar.summary.unavailableDays.toString()}
                        icon="🚫"
                        color="amber" 
                      />
                      <SummaryCard 
                        title="Modified Days" 
                        value={selectedCalendar.summary.modifiedDays.toString()}
                        icon="✏️"
                        color="violet" 
                      />
                      <SummaryCard 
                        title="Generated" 
                        value={format(new Date(selectedCalendar.generatedAt), 'MMM d, yyyy')}
                        icon="🔄"
                        color="slate" 
                      />
                    </div>
                  </div>
                  
                  {/* Calendar status badges */}
                  <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-3">Calendar Features</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedCalendar.summary.hasCustomPrices ? "default" : "outline"} className="px-3 py-1">
                        {selectedCalendar.summary.hasCustomPrices ? "✓" : "✗"} Custom Prices
                      </Badge>
                      <Badge variant={selectedCalendar.summary.hasSeasonalRates ? "default" : "outline"} className="px-3 py-1">
                        {selectedCalendar.summary.hasSeasonalRates ? "✓" : "✗"} Seasonal Rates
                      </Badge>
                      <Badge variant={selectedCalendar.summary.unavailableDays > 0 ? "default" : "outline"} className="px-3 py-1">
                        {selectedCalendar.summary.unavailableDays > 0 ? "✓" : "✗"} Has Unavailable Dates
                      </Badge>
                    </div>
                  </div>
                  
                  {/* Price range guide */}
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <h3 className="text-sm font-medium text-slate-500 mb-3">Price Range Guide</h3>
                    <div className="flex space-x-2">
                      <span className="px-3 py-1 bg-emerald-50 text-xs font-medium rounded-md border border-emerald-100">Low</span>
                      <span className="px-3 py-1 bg-blue-50 text-xs font-medium rounded-md border border-blue-100">Medium</span>
                      <span className="px-3 py-1 bg-amber-50 text-xs font-medium rounded-md border border-amber-100">High</span>
                      <span className="px-3 py-1 bg-rose-50 text-xs font-medium rounded-md border border-rose-100">Premium</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Helper component for summary cards
function SummaryCard({ 
  title, 
  value, 
  icon, 
  color = 'slate' 
}: { 
  title: string; 
  value: string; 
  icon?: string; 
  color?: 'slate' | 'emerald' | 'rose' | 'blue' | 'amber' | 'violet' | 'indigo';
}) {
  const colorMap = {
    slate: 'bg-slate-50 border-slate-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    rose: 'bg-rose-50 border-rose-200',
    blue: 'bg-blue-50 border-blue-200', 
    amber: 'bg-amber-50 border-amber-200',
    violet: 'bg-violet-50 border-violet-200',
    indigo: 'bg-indigo-50 border-indigo-200'
  };
  
  return (
    <div className={`rounded-lg border p-3.5 transition-all ${colorMap[color]} hover:shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium text-slate-600">{title}</div>
        {icon && <div className="text-lg">{icon}</div>}
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
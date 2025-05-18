'use client';

import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

interface CalendarTableProps {
  calendar: any;
  guestCount: string;
  getPriceColorClass: (price: number, minPrice: number, maxPrice: number) => string;
}

export function CalendarTable({ calendar, guestCount, getPriceColorClass }: CalendarTableProps) {
  // Calculate calendar data
  const firstDayOfMonth = new Date(calendar.year, calendar.month - 1, 1).getDay(); // 0-6 (Sun-Sat)
  const daysInMonth = new Date(calendar.year, calendar.month, 0).getDate();
  
  // Create weeks array
  const weeks = [];
  let day = 1;
  
  // Loop through weeks
  for (let week = 0; day <= daysInMonth; week++) {
    const weekDays = [];
    
    // Loop through days in a week
    for (let weekday = 0; weekday < 7; weekday++) {
      if ((week === 0 && weekday < firstDayOfMonth) || day > daysInMonth) {
        // Empty cell
        weekDays.push(<td key={`empty-${week}-${weekday}`} className="p-1"></td>);
      } else {
        // Day cell
        const dayData = calendar.days[day.toString()];
        if (!dayData) {
          weekDays.push(
            <td key={`missing-${day}`} className="p-1">
              <div className="p-2 border border-red-200 bg-red-50 rounded-lg h-full">
                <div className="text-sm font-bold text-red-700">{day}</div>
                <div className="text-xs text-red-600">Missing</div>
              </div>
            </td>
          );
        } else {
          const dayPrice = dayData.prices?.[guestCount] || dayData.adjustedPrice;
          const priceClass = getPriceColorClass(
            dayPrice, 
            calendar.summary.minPrice, 
            calendar.summary.maxPrice
          );
          
          // Calculate specific styling
          const isUnavailable = !dayData.available;
          const isWeekend = weekday === 0 || weekday === 6;
          const hasSpecialPrice = dayData.priceSource !== 'base';
          
          weekDays.push(
            <td key={`day-${day}`} className="p-1">
              <div
                className={`
                  p-2 h-full border rounded-lg shadow-sm transition-all hover:shadow-md
                  ${priceClass} 
                  ${isUnavailable ? 'opacity-60 bg-gray-100 border-gray-200' : 'border-slate-200'} 
                  ${isWeekend ? 'border-l-rose-300 border-l-2' : ''}
                `}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className={`text-sm font-bold ${isWeekend ? 'text-rose-600' : 'text-slate-700'}`}>
                    {day}
                  </div>
                  {hasSpecialPrice && (
                    <Badge 
                      variant={dayData.priceSource === 'override' ? 'destructive' : 'secondary'} 
                      className="text-[9px] px-1.5 py-0 rounded-full"
                    >
                      {dayData.priceSource === 'override' ? 'custom' : dayData.priceSource}
                    </Badge>
                  )}
                </div>
                
                <div className={`text-sm font-semibold ${isUnavailable ? 'line-through' : ''}`}>
                  {formatPrice(dayPrice)}
                </div>
                
                {dayData.minimumStay > 1 && (
                  <div className="text-xs text-slate-600 mt-1 italic">
                    Min: {dayData.minimumStay} night{dayData.minimumStay > 1 ? 's' : ''}
                  </div>
                )}
                
                {isUnavailable && (
                  <div className="text-xs text-rose-600 font-medium mt-1">
                    Unavailable
                  </div>
                )}
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
    <table className="w-full border-separate border-spacing-1">
      <thead>
        <tr>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
            <th 
              key={day} 
              className={`text-center font-semibold text-sm p-2 ${
                index === 0 || index === 6 ? 'text-rose-600' : 'text-slate-600'
              }`}
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
  );
}
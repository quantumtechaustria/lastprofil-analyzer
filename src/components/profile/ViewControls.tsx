import React from 'react';
import { Calendar, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ViewControlsProps {
  viewType: string;
  onViewTypeChange: (viewType: string) => void;
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  dateRange: { start: Date; end: Date } | null;
  showPeakLoad: boolean;
  onTogglePeakLoad: () => void;
  availableMonths: Date[];
  availableWeeks: Date[];
  isComparisonMode: boolean;
  yearViewMode?: string;
  onYearViewModeChange?: (mode: string) => void;
}

interface ViewControlsState {
  showDayPicker: boolean;
}

const ViewControls: React.FC<ViewControlsProps> = ({
  viewType,
  onViewTypeChange,
  selectedDate,
  onDateChange,
  memoizedDateRange,
  showPeakLoad,
  onTogglePeakLoad,
  availableMonths,
  availableWeeks,
  isComparisonMode,
  yearViewMode = 'months',
  onYearViewModeChange
}) => {
  const [showDayPicker, setShowDayPicker] = React.useState(false);
  const formatDateLabel = () => {
    switch (viewType) {
      case 'year':
        return format(selectedDate, 'yyyy');
      case 'month':
        return format(selectedDate, 'MMMM yyyy', { locale: de });
      case 'week':
        return `KW ${format(selectedDate, 'I/yyyy', { locale: de })}`;
      case 'day':
        return format(selectedDate, 'dd.MM.yyyy', { locale: de });
      case 'hour':
        return format(selectedDate, 'dd.MM.yyyy', { locale: de });
      default:
        return '';
    }
  };

  const canNavigatePrevious = () => {
    if (viewType === 'year') {
      const currentYear = selectedDate.getFullYear();
      const minYear = memoizedDateRange ? memoizedDateRange.start.getFullYear() : currentYear;
      return currentYear > minYear;
    }

    if (viewType === 'day' || viewType === 'hour') {
      if (!memoizedDateRange) return false;
      return selectedDate > memoizedDateRange.start;
    }

    const options = viewType === 'month' ? availableMonths : availableWeeks;
    const currentIndex = options.findIndex(date =>
      format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
    return currentIndex > 0;
  };

  const canNavigateNext = () => {
    if (viewType === 'year') {
      const currentYear = selectedDate.getFullYear();
      const maxYear = memoizedDateRange ? memoizedDateRange.end.getFullYear() : currentYear;
      return currentYear < maxYear;
    }

    if (viewType === 'day' || viewType === 'hour') {
      if (!memoizedDateRange) return false;
      return selectedDate < memoizedDateRange.end;
    }

    const options = viewType === 'month' ? availableMonths : availableWeeks;
    const currentIndex = options.findIndex(date =>
      format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
    return currentIndex < options.length - 1;
  };

  const handlePrevious = () => {
    if (viewType === 'year') {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(selectedDate.getFullYear() - 1);
      onDateChange(newDate);
      return;
    }

    if (viewType === 'day' || viewType === 'hour') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() - 1);
      onDateChange(newDate);
      return;
    }

    const options = viewType === 'month' ? availableMonths : availableWeeks;
    const currentIndex = options.findIndex(date =>
      format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
    if (currentIndex > 0) {
      onDateChange(options[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (viewType === 'year') {
      const newDate = new Date(selectedDate);
      newDate.setFullYear(selectedDate.getFullYear() + 1);
      onDateChange(newDate);
      return;
    }

    if (viewType === 'day' || viewType === 'hour') {
      const newDate = new Date(selectedDate);
      newDate.setDate(selectedDate.getDate() + 1);
      onDateChange(newDate);
      return;
    }

    const options = viewType === 'month' ? availableMonths : availableWeeks;
    const currentIndex = options.findIndex(date =>
      format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );
    if (currentIndex < options.length - 1) {
      onDateChange(options[currentIndex + 1]);
    }
  };

  return (
    <div className="mt-2 mb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Left group: view selector + Anzeige toggle + Datenbereich */}
        <div className="flex flex-wrap items-center gap-10">
          {/* View Type Selector */}
          <div className="flex flex-wrap rounded-lg bg-white p-1">
            {[
              { id: 'year', label: 'Jahr', description: 'Monatliche Übersicht' },
              { id: 'month', label: 'Monat', description: 'Tägliche Werte' },
              { id: 'week', label: 'Woche', description: 'Tägliche Werte' },
              { id: 'day', label: 'Tag', description: 'Stündliche Werte' },
              { id: 'hour', label: '15min', description: '15-Minuten-Werte' },
              { id: 'weekdayWeekend', label: 'Werktag/WE', description: 'Durchschnittsprofile' }
            ].map((type) => (
              <button
                key={type.id}
                onClick={() => onViewTypeChange(type.id)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewType === type.id
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title={type.description}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Year View Mode Toggle */}
          {viewType === 'year' && onYearViewModeChange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Anzeige:</span>
              <div className="flex rounded-lg bg-white p-1">
                <button
                  onClick={() => onYearViewModeChange('months')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    yearViewMode === 'months'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monate
                </button>
                <button
                  onClick={() => onYearViewModeChange('days')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    yearViewMode === 'days'
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Alle Tage
                </button>
              </div>
            </div>
          )}

          {/* Data Range Info */}
          {memoizedDateRange && (
            <p className="text-sm text-gray-500">
              {isComparisonMode ? 'Verfügbarer Zeitraum' : 'Datenbereich'}: {' '}
              {format(memoizedDateRange.start, 'dd.MM.yyyy', { locale: de })} - {' '}
              {format(memoizedDateRange.end, 'dd.MM.yyyy', { locale: de })}
            </p>
          )}
        </div>

        {/* Date Navigation */}
        {['year', 'month', 'week', 'day', 'hour'].includes(viewType) && (
          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevious}
              disabled={!canNavigatePrevious()}
              className="p-3 rounded-lg bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center space-x-2 min-w-0 relative bg-white rounded-lg px-3 py-3">
              <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
              {(viewType === 'day' || viewType === 'hour') ? (
                <div className="relative">
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    min={memoizedDateRange ? format(memoizedDateRange.start, 'yyyy-MM-dd') : undefined}
                    max={memoizedDateRange ? format(memoizedDateRange.end, 'yyyy-MM-dd') : undefined}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      if (!isNaN(newDate.getTime())) {
                        onDateChange(newDate);
                      }
                    }}
                    className="text-sm font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 cursor-pointer hover:border-sky-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              ) : (
                <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  {formatDateLabel()}
                </span>
              )}
            </div>
            
            <button
              onClick={handleNext}
              disabled={!canNavigateNext()}
              className="p-3 rounded-lg bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ViewControls;
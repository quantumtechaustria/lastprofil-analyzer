// Web Worker für Datenaggregation
import { 
  aggregateToMonthlyData, 
  aggregateToDailyData, 
  aggregateToWeeklyData, 
  aggregateToHourlyData, 
  getDailyLoadProfile,
  getDateRange,
  getAvailableMonths,
  getAvailableWeeks,
  getWeekdayWeekendAverageProfiles
} from '../lib/data-aggregation';

export interface WorkerMessage {
  type: 'AGGREGATE_DATA' | 'GET_DATE_RANGE' | 'GET_AVAILABLE_DATES';
  payload: {
    profiles: any[];
    viewType: string;
    selectedDate: Date;
    yearViewMode?: string;
  };
  id: string;
}

export interface WorkerResponse {
  type: 'AGGREGATION_COMPLETE' | 'DATE_RANGE_COMPLETE' | 'AVAILABLE_DATES_COMPLETE' | 'ERROR';
  payload: any;
  id: string;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload, id } = event.data;
  
  try {
    console.log(`🔄 Worker: Verarbeite ${type} für ${payload.profiles.length} Profile`);
    const startTime = Date.now();
    
    switch (type) {
      case 'GET_DATE_RANGE': {
        let minStart: Date | null = null;
        let maxEnd: Date | null = null;

        payload.profiles.forEach(profile => {
          if (profile.parsedData) {
            const range = getDateRange(profile.parsedData);
            if (range) {
              if (!minStart || range.start < minStart) minStart = range.start;
              if (!maxEnd || range.end > maxEnd) maxEnd = range.end;
            }
          }
        });

        const result = minStart && maxEnd ? { start: minStart, end: maxEnd } : null;
        
        self.postMessage({
          type: 'DATE_RANGE_COMPLETE',
          payload: result,
          id
        } as WorkerResponse);
        break;
      }

      case 'GET_AVAILABLE_DATES': {
        let allMonths: Date[] = [];
        let allWeeks: Date[] = [];

        payload.profiles.forEach(profile => {
          if (profile.parsedData) {
            const months = getAvailableMonths(profile.parsedData);
            const weeks = getAvailableWeeks(profile.parsedData);
            allMonths = [...allMonths, ...months];
            allWeeks = [...allWeeks, ...weeks];
          }
        });

        // Remove duplicates and sort
        const uniqueMonths = Array.from(new Set(allMonths.map(d => d.getTime())))
          .map(time => new Date(time))
          .sort((a, b) => a.getTime() - b.getTime());

        const uniqueWeeks = Array.from(new Set(allWeeks.map(d => d.getTime())))
          .map(time => new Date(time))
          .sort((a, b) => a.getTime() - b.getTime());

        self.postMessage({
          type: 'AVAILABLE_DATES_COMPLETE',
          payload: {
            availableMonths: uniqueMonths,
            availableWeeks: uniqueWeeks
          },
          id
        } as WorkerResponse);
        break;
      }

      case 'AGGREGATE_DATA': {
        const { profiles, viewType, selectedDate, yearViewMode = 'months' } = payload;
        
        // For weekday-weekend view, use special aggregation
        if (viewType === 'weekdayWeekend') {
          const weekdayWeekendData = profiles.map((profile: any, index: number) => {
            if (!profile.parsedData) return null;
            const data = getWeekdayWeekendAverageProfiles(profile.parsedData);
            return {
              profileIndex: index,
              data
            };
          }).filter(Boolean);

          if (weekdayWeekendData.length === 0) {
            self.postMessage({
              type: 'AGGREGATION_COMPLETE',
              payload: [],
              id
            } as WorkerResponse);
            return;
          }

          // Merge all profiles' weekday-weekend data
          const mergedData: any[] = [];
          const maxLength = Math.max(...weekdayWeekendData.map(p => p!.data.weekdays.length));

          for (let i = 0; i < maxLength; i++) {
            const dataPoint: any = { time: weekdayWeekendData[0]!.data.weekdays[i]?.time || `${i}:00` };
            
            weekdayWeekendData.forEach((profileData, profileIndex) => {
              if (profileData && profileData.data.weekdays[i] && profileData.data.weekends[i]) {
                dataPoint[`profile${profileIndex + 1}_weekday_avg_kw`] = profileData.data.weekdays[i].kw;
                dataPoint[`profile${profileIndex + 1}_weekend_avg_kw`] = profileData.data.weekends[i].kw;
              }
            });
            
            mergedData.push(dataPoint);
          }

          self.postMessage({
            type: 'AGGREGATION_COMPLETE',
            payload: mergedData,
            id
          } as WorkerResponse);
          
          const processingTime = Date.now() - startTime;
          console.log(`✅ Worker: Weekday/Weekend-Aggregation abgeschlossen in ${processingTime}ms`);
          return;
        }

        // Regular aggregation for other view types
        const allData: { [key: string]: any } = {};

        profiles.forEach((profile: any, profileIndex: number) => {
          if (!profile.parsedData) return;

          let profileData: any[] = [];
          
          switch (viewType) {
            case 'year':
              if (yearViewMode === 'months') {
                profileData = aggregateToMonthlyData(profile.parsedData, selectedDate);
              } else {
                profileData = aggregateToDailyData(profile.parsedData, selectedDate, 'year');
              }
              break;
            case 'month':
              profileData = aggregateToDailyData(profile.parsedData, selectedDate);
              break;
            case 'week':
              profileData = aggregateToWeeklyData(profile.parsedData, selectedDate);
              break;
            case 'day':
              profileData = aggregateToHourlyData(profile.parsedData, selectedDate);
              break;
            case 'hour':
              profileData = getDailyLoadProfile(profile.parsedData, selectedDate);
              break;
            default:
              profileData = [];
          }

          // Merge profile data into combined dataset
          profileData.forEach((dataPoint: any) => {
            // Für Tages- und 15-Min-Ansicht alle Punkte beibehalten (volle 0-24h Achse)
            if (viewType !== 'day' && viewType !== 'hour') {
              if (!dataPoint.kwh || dataPoint.kwh === 0) {
                return;
              }
            }

            let key: string;
            let keyField: string;

            if (viewType === 'year') {
              if (yearViewMode === 'months') {
                key = dataPoint.month;
                keyField = 'month';
              } else {
                key = dataPoint.date || dataPoint.day;
                keyField = 'day';
              }
            } else if (viewType === 'month' || viewType === 'week') {
              key = dataPoint.day || dataPoint.date;
              keyField = 'day';
            } else if (viewType === 'day') {
              key = dataPoint.time;
              keyField = 'time';
            } else if (viewType === 'hour') {
              key = dataPoint.time;
              keyField = 'time';
            } else {
              key = dataPoint.time || dataPoint.day || dataPoint.month;
              keyField = 'time';
            }

            if (!allData[key]) {
              allData[key] = { [keyField]: key };
            }

            // Add profile-specific data
            if (viewType === 'hour') {
              // For hour view, use kW values
              allData[key][`profile${profileIndex + 1}_avg_kw`] = dataPoint.kw || dataPoint.avg_kw || 0;
              allData[key][`profile${profileIndex + 1}_kwh`] = dataPoint.kwh || 0;
            } else {
              // For other views, use kWh values
              allData[key][`profile${profileIndex + 1}_kwh`] = dataPoint.kwh || 0;
              allData[key][`profile${profileIndex + 1}_avg_kw`] = dataPoint.avg_kw || dataPoint.kw || 0;
            }

            // Always add peak load data if available
            if (dataPoint.peak_kw !== undefined) {
              allData[key][`profile${profileIndex + 1}_peak_kw`] = dataPoint.peak_kw;
            }
          });
        });

        const result = Object.values(allData).sort((a: any, b: any) => {
          // Determine the key field for sorting
          let sortField: string;
          if (viewType === 'year') {
            sortField = yearViewMode === 'months' ? 'month' : 'day';
          } else if (viewType === 'month' || viewType === 'week') {
            sortField = 'day';
          } else {
            sortField = 'time';
          }
          
          const aKey = a[sortField] || '';
          const bKey = b[sortField] || '';
          
          // Handle different sorting logic based on view type
          if (viewType === 'hour' || viewType === 'day') {
            // For time-based sorting, convert to comparable format
            return aKey.localeCompare(bKey);
          } else {
            // For date-based sorting
            return aKey.localeCompare(bKey);
          }
        });

        const processingTime = Date.now() - startTime;
        console.log(`✅ Worker: Aggregation abgeschlossen in ${processingTime}ms für ${result.length} Datenpunkte`);

        self.postMessage({
          type: 'AGGREGATION_COMPLETE',
          payload: result,
          id
        } as WorkerResponse);
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('❌ Worker Error:', error);
    self.postMessage({
      type: 'ERROR',
      payload: { error: error.message },
      id
    } as WorkerResponse);
  }
};
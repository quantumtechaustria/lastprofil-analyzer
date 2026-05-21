import { Calendar, X, Download } from 'lucide-react';

interface ApiDateRangeModalProps {
  onClose: () => void;
  onFetch: (startDate: Date, endDate: Date) => void;
  isLoading: boolean;
}

export default function ApiDateRangeModal({ onClose, onFetch, isLoading }: ApiDateRangeModalProps) {
  const handleLoad2024 = () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    onFetch(start, end);
  };

  const handleLoad2025 = () => {
    const start = new Date('2025-01-01');
    const end = new Date('2025-12-31');
    end.setHours(23, 59, 59, 999);
    onFetch(start, end);
  };

  const handleLoad2026 = () => {
    const start = new Date('2026-01-01');
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);
    onFetch(start, end);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-xl font-semibold">Preise von Energy-Charts API laden</h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Energy-Charts API (Fraunhofer ISE)</p>
                <p>Bidding Zone: AT (Österreich)</p>
                <p className="mt-2 text-xs">Lizenz: CC BY 4.0 für private und interne Nutzung</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <button
              onClick={handleLoad2024}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white text-lg font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>{isLoading ? 'Lädt...' : 'Lade komplettes Jahr 2024'}</span>
            </button>

            <button
              onClick={handleLoad2025}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-sky-600 text-white text-lg font-medium rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>{isLoading ? 'Lädt...' : 'Lade komplettes Jahr 2025'}</span>
            </button>

            <button
              onClick={handleLoad2026}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-teal-600 text-white text-lg font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              <span>{isLoading ? 'Lädt...' : 'Lade 2026 bis heute (+1 Tag)'}</span>
            </button>
          </div>

          <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              <strong>2024:</strong> Lädt das komplette Jahr 2024 (01.01. - 31.12.2024)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>2025:</strong> Lädt das komplette Jahr 2025 (01.01. - 31.12.2025)
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>2026:</strong> Lädt von 01.01.2026 bis heute + 1 Tag (Day-Ahead Preise)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

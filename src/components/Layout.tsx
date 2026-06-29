import React, { ReactNode } from 'react';
import {
  Zap,
  BarChart3,
  Settings,
  Upload,
  CreditCard,
  Menu,
  X,
  User,
  LogOut,
  TrendingUp,
  Percent
} from 'lucide-react';
import { useState } from 'react';

interface LayoutProps {
  children: ReactNode;
  currentPage?: string;
  onNavigate?: (page: string) => void;
  user?: any;
  organization?: any;
  onSignOut?: () => void;
}

export default function Layout({ 
  children, 
  currentPage = 'dashboard', 
  onNavigate,
  user,
  organization,
  onSignOut 
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', icon: Zap },
    { name: 'Upload', id: 'upload', icon: Upload },
    { name: 'Spot-Preise', id: 'spot-prices', icon: TrendingUp },
    { name: 'Teilnahmefaktor', id: 'participation-factor', icon: Percent },
    { name: 'Abrechnung', id: 'billing', icon: CreditCard },
    { name: 'Einstellungen', id: 'settings', icon: Settings },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="relative flex-1 flex flex-col max-w-xs w-full pt-5 pb-4 bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <div className="flex-shrink-0 flex items-center px-4">
            <Zap className="h-8 w-8 text-sky-500" />
            <span className="ml-2 text-xl font-bold text-gray-900">Lastprofil Analyzer</span>
          </div>
          <nav className="mt-5 flex-shrink-0 h-full divide-y divide-gray-200 overflow-y-auto">
            <div className="px-2 space-y-1">
              {navigation.map((item) => (
                <button
                  key={item.name}
                  onClick={() => {
                    onNavigate?.(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors ${
                    currentPage === item.id
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    currentPage === item.id ? 'text-sky-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`} />
                  {item.name}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        <div className="flex flex-col flex-1 min-h-0 border-r border-gray-200 bg-white">
          <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-gray-200">
            <Zap className="h-8 w-8 text-sky-500" />
            <span className="ml-2 text-xl font-bold text-gray-900">Lastprofil Analyzer</span>
          </div>
          <nav className="flex-1 px-2 py-4 bg-white space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => onNavigate?.(item.id)}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md w-full text-left transition-colors ${
                  currentPage === item.id
                    ? 'bg-sky-50 text-sky-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <item.icon className={`mr-3 flex-shrink-0 h-6 w-6 ${
                  currentPage === item.id ? 'text-sky-500' : 'text-gray-400 group-hover:text-gray-500'
                }`} />
                {item.name}
              </button>
            ))}
          </nav>
          
          {/* User info */}
          {user && (
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="h-5 w-5 text-gray-600" />
                  </div>
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user.email}</p>
                  {organization && (
                    <p className="text-xs text-gray-500">{organization.name}</p>
                  )}
                </div>
                <button
                  onClick={onSignOut}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden md:ml-64">
        {/* Top bar */}
        <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow-sm border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex-1 px-4 flex justify-between items-center">
            <div className="flex-1 flex">
              <h1 className="text-2xl font-semibold text-gray-900 capitalize">
                {currentPage === 'dashboard' ? 'Dashboard' :
                 currentPage === 'upload' ? 'Upload' :
                 currentPage === 'spot-prices' ? 'Spot-Preise' :
                 currentPage === 'participation-factor' ? 'Teilnahmefaktor' :
                 currentPage === 'billing' ? 'Abrechnung' :
                 currentPage === 'settings' ? 'Einstellungen' : currentPage}
              </h1>
            </div>
            {organization && (
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                  organization.subscription_plan === 'enterprise' ? 'bg-purple-100 text-purple-800' :
                  organization.subscription_plan === 'pro' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {organization.subscription_plan}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
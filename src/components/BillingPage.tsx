import React, { useState } from 'react';
import { Check, CreditCard, Download, AlertCircle } from 'lucide-react';

interface BillingPageProps {
  organization?: any;
}

export default function BillingPage({ organization }: BillingPageProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>(organization?.subscription_plan || 'free');

  const plans = [
    {
      id: 'free',
      name: 'Kostenlos',
      price: 0,
      description: 'Perfekt für den Einstieg',
      features: [
        '1 CSV-Upload pro Monat',
        'Basis-KPI-Analyse',
        'Standard-PDF-Berichte',
        'E-Mail-Support',
        'Datenspeicherung: 3 Monate'
      ],
      limitations: [
        'Begrenzt auf 1 Upload',
        'Nur Basis-Diagramme',
        'Keine White-Label-Berichte'
      ]
    },
    {
      id: 'pro',
      name: 'Professional',
      price: 249,
      description: 'Für Energieprofis',
      features: [
        'Unbegrenzte CSV-Uploads',
        'Erweiterte KPI-Analyse',
        'PV- & Speicher-Simulationen',
        'White-Label-PDF-Berichte',
        'Prioritäts-E-Mail-Support',
        'Datenspeicherung: 2 Jahre',
        'API-Zugang (100 Aufrufe/Monat)',
        'Multi-Standort-Vergleiche'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 999,
      description: 'Für große Organisationen',
      features: [
        'Alles aus Professional',
        'Unbegrenzte API-Aufrufe',
        'Portfolio-Dashboards',
        'Automatisierte Monatsberichte',
        'Individuelle Integrationen',
        'Persönlicher Account Manager',
        'SLA-Garantie',
        'On-Premise-Deployment-Option',
        'Erweiterte Benchmarks'
      ]
    }
  ];

  const invoices = [
    {
      id: 'INV-2024-001',
      date: '2024-01-01',
      amount: 249,
      status: 'Paid',
      plan: 'Professional'
    },
    {
      id: 'INV-2023-012',
      date: '2023-12-01',
      amount: 249,
      status: 'Paid',
      plan: 'Professional'
    },
    {
      id: 'INV-2023-011',
      date: '2023-11-01',
      amount: 249,
      status: 'Paid',
      plan: 'Professional'
    }
  ];

  const handleUpgrade = (planId: string) => {
    // In a real app, this would integrate with Stripe
    alert(`Upgrade auf ${plans.find(p => p.id === planId)?.name} Plan. Dies würde zur Stripe-Kasse weiterleiten.`);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Abrechnung & Abonnement</h2>
        <p className="text-gray-600">
          Verwalten Sie Ihr Abonnement, die Abrechnung und Rechnungen
        </p>
      </div>

      {/* Current Plan */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Aktueller Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Sie befinden sich derzeit im</p>
            <p className="text-xl font-semibold text-gray-900 capitalize">
              {organization?.subscription_plan === 'free' ? 'Kostenlos' : 
               organization?.subscription_plan === 'pro' ? 'Professional' : 
               organization?.subscription_plan === 'enterprise' ? 'Enterprise' : 'Kostenlos'} Plan
            </p>
            {organization?.subscription_plan !== 'free' && (
              <p className="text-sm text-gray-500 mt-1">
                Nächstes Abrechnungsdatum: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">
              €{plans.find(p => p.id === (organization?.subscription_plan || 'free'))?.price}
              <span className="text-sm font-normal text-gray-500">/Monat</span>
            </p>
          </div>
        </div>
      </div>

      {/* Subscription Plans */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-6">Verfügbare Pläne</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-lg shadow-sm border-2 ${
                plan.popular 
                  ? 'border-sky-500' 
                  : selectedPlan === plan.id
                    ? 'border-sky-300'
                    : 'border-gray-200'
              } p-6`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sky-500 text-white">
                    Beliebtester Plan
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h4 className="text-lg font-medium text-gray-900">{plan.name}</h4>
                <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-gray-900">€{plan.price}</span>
                  <span className="text-sm text-gray-500">/Monat</span>
                </div>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="ml-3 text-sm text-gray-600">{feature}</span>
                  </li>
                ))}
                {plan.limitations?.map((limitation, index) => (
                  <li key={index} className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="ml-3 text-sm text-gray-500">{limitation}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {selectedPlan === plan.id ? (
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-500 py-2 px-4 rounded-md text-sm font-medium cursor-not-allowed"
                  >
                    Aktueller Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      plan.popular
                        ? 'bg-sky-500 text-white hover:bg-sky-600'
                        : 'bg-white text-sky-600 border border-sky-600 hover:bg-sky-50'
                    }`}
                  >
                    {plan.price > (plans.find(p => p.id === selectedPlan)?.price || 0) ? 'Upgrade' : 'Downgrade'}
                    {plan.price > (plans.find(p => p.id === selectedPlan)?.price || 0) ? 'Upgraden' : 'Downgraden'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Zahlungsmethode</h3>
        <div className="flex items-center space-x-3">
          <CreditCard className="h-8 w-8 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-900">•••• •••• •••• 4242</p>
            <p className="text-sm text-gray-500">Läuft ab 12/26</p>
          </div>
          <button className="ml-auto text-sm text-sky-600 hover:text-sky-700 font-medium">
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Billing History */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Rechnungshistorie</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{invoice.id}</p>
                <p className="text-sm text-gray-500">
                  {new Date(invoice.date).toLocaleDateString('de-DE')} • {invoice.plan}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                  {invoice.status === 'Paid' ? 'Bezahlt' : invoice.status}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  €{invoice.amount}
                </span>
                <button className="text-gray-400 hover:text-gray-600">
                  <Download className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface QuoteAssistantProps {
  companyId?: string;
  productGrade?: string;
  targetPrice?: number;
  targetQuantity?: number;
  costPrice?: number;
  currency?: string;
  onApplyPrice?: (price: number) => void;
  onApplyDiscount?: (discount: number) => void;
}

export default function QuoteAssistant({
  companyId: _companyId,
  productGrade,
  targetPrice,
  targetQuantity,
  costPrice,
  currency = 'USD',
  onApplyPrice,
  onApplyDiscount,
}: QuoteAssistantProps) {
  const { t } = useTranslation();
  const insights = useMemo(() => {
    const result: {
      suggestedPrice: number | null;
      priceRange: { low: number; high: number } | null;
      marginAtSuggested: number | null;
      marginAtTarget: number | null;
      discountSuggestions: number[];
      volumeDiscount: { qty: number; discount: number }[];
      notes: string[];
    } = {
      suggestedPrice: null,
      priceRange: null,
      marginAtSuggested: null,
      marginAtTarget: null,
      discountSuggestions: [],
      volumeDiscount: [],
      notes: [],
    };

    // Price estimation based on product family
    if (productGrade) {
      const upper = productGrade.toUpperCase();
      let basePrice = 0;
      if (upper.includes('PEEK')) basePrice = 85;
      else if (upper.includes('PAI')) basePrice = 120;
      else if (upper.includes('PI')) basePrice = 130;
      else if (upper.includes('PEI')) basePrice = 45;
      else if (upper.includes('PSU')) basePrice = 25;
      else if (upper.includes('PPSU')) basePrice = 60;
      else if (upper.includes('PPS')) basePrice = 25;
      else if (upper.includes('PTFE')) basePrice = 30;
      else if (upper.includes('PVDF')) basePrice = 25;
      else if (upper.includes('PCTFE')) basePrice = 60;
      else if (upper.includes('PFA')) basePrice = 45;
      else if (upper.includes('PET')) basePrice = 5;
      else if (upper.includes('PA66')) basePrice = 5;
      else if (upper.includes('POM')) basePrice = 3;
      else if (upper.includes('HDPE')) basePrice = 2;
      else basePrice = 10;

      // Adjust for form (rod/sheet/tube generally higher than granule)
      if (upper.includes('ROD') || upper.includes('SHEET') || upper.includes('TUBE')) {
        basePrice *= 1.3;
      }

      // Volume adjustment
      const qty = targetQuantity || 1;
      if (qty > 1000) basePrice *= 0.75;
      else if (qty > 500) basePrice *= 0.85;
      else if (qty > 100) basePrice *= 0.92;

      result.suggestedPrice = Math.round(basePrice * 100) / 100;
      result.priceRange = {
        low: Math.round(basePrice * 0.85 * 100) / 100,
        high: Math.round(basePrice * 1.15 * 100) / 100,
      };

      // Margin calculations
      if (costPrice && result.suggestedPrice) {
        result.marginAtSuggested = Math.round(((result.suggestedPrice - costPrice) / result.suggestedPrice) * 100);
      }
      if (costPrice && targetPrice) {
        result.marginAtTarget = Math.round(((targetPrice - costPrice) / targetPrice) * 100);
      }

      // Discount suggestions
      result.discountSuggestions = [3, 5, 8, 10];

      // Volume discount tiers
      result.volumeDiscount = [
        { qty: 100, discount: 3 },
        { qty: 250, discount: 5 },
        { qty: 500, discount: 8 },
        { qty: 1000, discount: 12 },
      ];

      // Notes
      if (upper.includes('PEEK')) {
        result.notes.push(t('page.quoteAssistant.priceVolatile'));
      }
      if (upper.includes('PAI') || upper.includes('PI')) {
        result.notes.push(t('page.quoteAssistant.premiumLeadTime'));
      }
      if (costPrice && result.suggestedPrice) {
        if (result.marginAtSuggested! < 15) {
          result.notes.push(t('page.quoteAssistant.lowMargin', { margin: result.marginAtSuggested }));
        } else if (result.marginAtSuggested! > 40) {
          result.notes.push(t('page.quoteAssistant.healthyMargin', { margin: result.marginAtSuggested }));
        }
      }
    }

    return result;
  }, [productGrade, targetQuantity, costPrice, targetPrice, t]);

  if (!productGrade) {
    return (
      <div className="card p-4 bg-gray-50 border-gray-200">
        <h3 className="section-label mb-2">{t('page.quoteAssistant.quoteAssistant')}</h3>
        <p className="text-xs text-gray-400">{t('page.quoteAssistant.addProductGrade')}</p>
      </div>
    );
  }

  const sym = currency === 'USD' ? '$' : '¥';

  return (
    <div className="data-surface p-4">
      <h3 className="section-label mb-3">
        {t('page.quoteAssistant.quoteAssistant')}
      </h3>

      <div className="space-y-3">
        {/* Suggested Price */}
        <div className="border-t border-gray-200 py-3">
          <div className="text-2xs text-gray-400 mb-1">{t('page.quoteAssistant.suggestedPrice')}</div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-xl font-semibold text-blue-600 tabular-nums">
                {sym}{insights.suggestedPrice?.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 ml-1">/kg</span>
            </div>
            {onApplyPrice && (
              <button
                onClick={() => insights.suggestedPrice && onApplyPrice(insights.suggestedPrice)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('page.quoteAssistant.apply')}
              </button>
            )}
          </div>
          {insights.priceRange && (
            <div className="text-2xs text-gray-400 mt-1">
              {t('page.quoteAssistant.range')}: {sym}{insights.priceRange.low.toFixed(2)} - {sym}{insights.priceRange.high.toFixed(2)}
            </div>
          )}
        </div>

        {/* Margin Analysis */}
        {costPrice && (
          <div className="border-t border-gray-200 py-3">
            <div className="text-2xs text-gray-400 mb-1">{t('page.quoteAssistant.marginAnalysis')}</div>
            {insights.marginAtSuggested !== null && (
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600">{t('page.quoteAssistant.atSuggestedPrice')}</span>
                <span className={`tabular-nums font-semibold ${
                  insights.marginAtSuggested >= 20 ? 'text-green-600' :
                  insights.marginAtSuggested >= 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {insights.marginAtSuggested}%
                </span>
              </div>
            )}
            {insights.marginAtTarget !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{t('page.quoteAssistant.atTargetPrice')} ({sym}{targetPrice})</span>
                <span className={`tabular-nums font-semibold ${
                  insights.marginAtTarget >= 20 ? 'text-green-600' :
                  insights.marginAtTarget >= 10 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {insights.marginAtTarget}%
                </span>
              </div>
            )}
            <div className="text-2xs text-gray-400 mt-1">{t('page.quoteAssistant.cost')}: {sym}{(costPrice || 0).toFixed(2)}/kg</div>
          </div>
        )}

        {/* Volume Discount Tiers */}
        <div className="border-t border-gray-200 py-3">
          <div className="text-2xs text-gray-400 mb-2">{t('page.quoteAssistant.volumeDiscountSuggestions')}</div>
          <div className="space-y-1">
            {insights.volumeDiscount.map((vd, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-600">{vd.qty}+ kg</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-medium">{t('page.quoteAssistant.percentOff', { discount: vd.discount })}</span>
                  {onApplyDiscount && (
                    <button
                      onClick={() => onApplyDiscount(vd.discount)}
                      className="text-blue-600 hover:text-blue-700 text-2xs"
                    >
                      {t('page.quoteAssistant.apply')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Standard Discounts */}
        <div className="border-t border-gray-200 py-3">
          <div className="text-2xs text-gray-400 mb-2">{t('page.quoteAssistant.quickDiscounts')}</div>
          <div className="flex flex-wrap gap-1.5">
            {insights.discountSuggestions.map(d => (
              <button
                key={d}
                onClick={() => onApplyDiscount?.(d)}
                className="px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {d}%
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        {insights.notes.length > 0 && (
          <div className="status-edge-warning rounded px-3 py-2.5">
            <div className="text-2xs text-yellow-700 font-medium mb-1">{t('page.quoteAssistant.insights')}</div>
            <ul className="space-y-0.5">
              {insights.notes.map((note, i) => (
                <li key={i} className="text-xs text-yellow-800">{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

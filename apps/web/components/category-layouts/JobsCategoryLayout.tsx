

import { useState } from "react";

interface Filters {
  search: string;
  province: string;
  district: string;
  commune: string;
  sort: string;
  price: number;
  minPrice: string;
  maxPrice: string;
  priceRange: string;
   condition: string;
  year: string;
  engine: string;
  salaryRange: string;
  salary: number;
}

interface CarCategoryLayoutProps {
  category: {
    name: string;
    slug: string;
    subcategories: { name: string; slug: string }[];
  };
}

export default function JobsCategoryLayout({
  category,
}: CarCategoryLayoutProps) {
  const [, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    province: "",
    district: "",
    commune: "",
    sort: "latest",
    price: 0,
    minPrice: "",
    maxPrice: "",
    priceRange: "",
    condition: "",//  Initialize
                year: "",
                engine: "",
                salary:0,
                salaryRange:"",
  });

  const [showLocationDropdown, setShowLocationDropdown] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [showPriceDropdown, setShowPriceDropdown] = useState(false)

  // Helper to format province display name
  const getProvinceLabel = () => {
    if (!filters.province) return "All Locations";
    if (filters.province === "phnom-penh") return "Phnom Penh";
    if (filters.province === "siem-reap") return "Siem Reap";
    if (filters.province === "battambang") return "Battambang";
    if (filters.province === "sihanoukville") return "Sihanoukville";
    return filters.province.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getSortLabel = () => {
    if (filters.sort === 'latest') return 'Sort';
    if (filters.sort === 'oldest') return 'Oldest First';
    if (filters.sort === 'price-low') return 'Price: Low to High';
    if (filters.sort === 'price-high') return 'Price: High to Low';
    return 'Sort';
  };

  const getPriceLabel = () => {
    if (!filters.priceRange) return 'Salary';
    switch (filters.priceRange) {
      case 'under-100': return 'Under $100';
      case '100-500': return '$100-$500';
      case '500-plus': return '$500+';
      default: return 'Salary';
    }
  };

  return (
    <div className="max-w-7xl select-none bg-muted">
      {/* HEADER */}
      <div className="flex items-center justify-between bg-card rounded-t-sm mb-2">
        <h1 className="font-semibold text-lg md:text-lg p-3">
          {category.name}{" "}
          <span className="font-semibold text-lg">in Cambodia</span>
        </h1>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap gap-2 items-center bg-card rounded-b-sm p-2 mb-1">
        {/* Location Filter */}
        <div className="relative ">
          <button
            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
            className={`flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-sm hover:bg-gray-200
              ${filters.province 
                ? 'bg-blue-50 border-blue-300 text-blue-700' 
                : 'text-gray-700'}`}
          >
            <i className="bi bi-geo-alt text-sm"></i>
            <span className="font-medium whitespace-nowrap">{getProvinceLabel()}</span>
            <i className={`bi bi-chevron-down text-xs transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`}></i>
          </button>

          {showLocationDropdown && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
              {[
                { val: '', label: 'All Locations' },
                { val: 'phnom-penh', label: 'Phnom Penh' },
                { val: 'siem-reap', label: 'Siem Reap' },
                { val: 'battambang', label: 'Battambang' },
                { val: 'sihanoukville', label: 'Sihanoukville' }
              ].map((loc) => (
                <button
                  key={loc.val}
                  onClick={() => {
                    setFilters({ ...filters, province: loc.val });
                    setShowLocationDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span>{loc.label}</span>
                  {filters.province === loc.val && (
                    <i className="bi bi-check text-blue-600"></i>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Filter */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className={`flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-sm hover:bg-gray-200
              ${filters.sort !== 'latest'
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'text-gray-700'}`}
          >
            <span className="font-medium whitespace-nowrap">{getSortLabel()}</span>
            <i className={`bi bi-chevron-down text-xs transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}></i>
          </button>

          {showSortDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
              {[
                { val: 'latest', label: 'Newest First' },
                { val: 'oldest', label: 'Oldest First' },
                { val: 'price-low', label: 'Price: Low to High' },
                { val: 'price-high', label: 'Price: High to Low' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => {
                    setFilters({ ...filters, sort: opt.val });
                    setShowSortDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  {filters.sort === opt.val && (
                    <i className="bi bi-check text-blue-600"></i>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price Filter - Changed label to Salary */}
        <div className="relative">
          <button
            onClick={() => setShowPriceDropdown(!showPriceDropdown)}
            className={`flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-sm hover:bg-gray-200
              ${filters.priceRange
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'text-gray-700'}`}
          >
            <span className="font-medium whitespace-nowrap">{getPriceLabel()}</span>
            <i className={`bi bi-chevron-down text-xs transition-transform ${showPriceDropdown ? 'rotate-180' : ''}`}></i>
          </button>

          {showPriceDropdown && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-2">
              {[
                { val: '', label: 'All Salaries' },
                { val: 'under-100', label: 'Under $100' },
                { val: '100-500', label: '$100 - $500' },
                { val: '500-plus', label: '$500+' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => {
                    setFilters({ ...filters, priceRange: opt.val });
                    setShowPriceDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span>{opt.label}</span>
                  {filters.priceRange === opt.val && (
                    <i className="bi bi-check text-blue-600"></i>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* More Filters Button */}
        <button
          onClick={() => setShowFilters(true)}
          className="ml-auto flex items-center gap-1 bg-gray-100 border border-gray-200 rounded px-3 py-1.5 text-sm hover:bg-gray-200 text-gray-700"
        >
          <i className="bi bi-funnel text-sm"></i>
          <span className="font-medium whitespace-nowrap">More Filters</span>
        </button>
      </div>

      {/* MODAL */}
      {/* {showFilters && (
        <FiltersModal
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )} */}
    </div>
  );
}
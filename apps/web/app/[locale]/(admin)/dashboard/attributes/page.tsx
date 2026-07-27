import { Link } from "@/i18n/routing";

const ATTRIBUTES = [
  { href: "/dashboard/attributes/brands", title: "Brands" },
  { href: "/dashboard/attributes/models", title: "Models" },
  { href: "/dashboard/attributes/bodytypes", title: "Body Types" },
  { href: "/dashboard/attributes/enginetypes", title: "Engine Types" },
  { href: "/dashboard/attributes/vehicletypes", title: "Vehicle Types" },
  { href: "/dashboard/attributes/accessories", title: "Accessories" },
  { href: "/dashboard/attributes/types", title: "Types" },
  { href: "/dashboard/attributes/jobtypes", title: "Job Types" },
  { href: "/dashboard/attributes/networks", title: "Networks" },
  { href: "/dashboard/attributes/bedrooms", title: "Bedrooms" },
  { href: "/dashboard/attributes/bathrooms", title: "Bathrooms" },
  { href: "/dashboard/attributes/facings", title: "Facings" },
  { href: "/dashboard/attributes/experiences", title: "Experiences" },
  { href: "/dashboard/attributes/storages", title: "Storages" },
  { href: "/dashboard/attributes/screensizes", title: "Screen Sizes" },
  { href: "/dashboard/attributes/rams", title: "RAMs" },
  { href: "/dashboard/attributes/cpus", title: "CPUs" },
  { href: "/dashboard/attributes/vgas", title: "VGAs" },
  { href: "/dashboard/attributes/colors", title: "Colors" },
  { href: "/dashboard/attributes/years", title: "Years" },
] as const;

export default function AttributePage() {
  return (
    <main className="flex-1 overflow-auto p-6 min-w-0">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-[#00a0e9] text-2xl font-semibold tracking-tight">
            Attributes
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage the option sets used by listing forms.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ATTRIBUTES.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium hover:border-[#00a0e9] hover:text-[#00a0e9] transition-colors"
            >
              {a.title}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

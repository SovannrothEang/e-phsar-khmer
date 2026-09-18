import React from "react";
import { IconHome, IconChevronRight } from "@tabler/icons-react";
import { Link } from "@/i18n/routing";

// Define the data structure for the metric rows
const insights = [
  {
    label: "Impression",
    value: 0,
    description: "The number of times your ad was shown.",
  },
  {
    label: "Engagement",
    value: 0,
    description:
      "The total number of actions that people take involving your ads.",
  },
  {
    label: "View",
    value: 0,
    description: "Number of times people view your ads details.",
  },
  {
    label: "Chat",
    value: 0,
    description: "Number of times people click chat.",
  },
  {
    label: "Call",
    value: 0,
    description: "Number of times people click call.",
  },
  {
    label: "Show Contact",
    value: 0,
    description: "Number of times people click show contact.",
  },
  {
    label: "Apply job",
    value: 0,
    description: "Number of times people click apply job.",
  },
];

export default function InsightPage() {
  return (
    <div className="min-h-screen bg-muted pb-10">
      <div className="max-w-7xl mx-auto py-8">
        <nav className="flex items-center space-x-2 text-sm ">
          <Link
            href="/"
            className="group flex items-center transition-colors duration-150 text-foreground  group-hover:underline"
          >
            <IconHome
              size={16}
              className="text-foreground  group-hover:underline"
            />
            <span className="text-foreground  group-hover:underline pl-1.5">
              Home
            </span>
          </Link>
          <IconChevronRight size={16} className="block text-gray-500" />
          <Link
            href="/me"
            className="group flex items-center transition-colors duration-150 text-gray-500 dark:text-gray-400 hover:underline"
          >
            <span className="text-foreground  group-hover:underline pl-1.5">
              Profile
            </span>
          </Link>
          <IconChevronRight size={16} className="block text-gray-500" />
          <h1 className="text-gray-500 dark:text-gray-400">Insight</h1>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4">
        <h1 className="text-2xl font-semibold text-foreground mb-4">Insight</h1>
        <div className="bg-card border rounded-sm shadow-sm overflow-hidden">
          {/* Section Header */}
          <div className="px-4 py-4">
            <h2 className="text-lg font-semibold text-foreground">Summary</h2>
          </div>
          {/* Metrics List */}
          <div className="divide-y divide-muted">
            {insights.map((item, index) => (
              <div
                key={index}
                className="px-4 py-4 flex items-start justify-between group transition-colors"
              >
                <div className="space-y-1">
                  <h3 className="text-md font-medium text-foreground">
                    {item.label}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                    {item.description}
                  </p>
                </div>
                <div className="text-lg font-medium text-foreground">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

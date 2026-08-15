import { Bookmark } from 'lucide-react';

export default function SavedAds() {
  return (
    <div className="min-w-full bg-muted pb-50 pt-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-medium text-foreground mb-4">Saved</h1>
        <main className="max-w-2xl mx-auto mt-3">
          <div className="bg-card rounded-xs shadow-sm  min-h-[500px] flex flex-col items-center justify-center p-6">
            <div className="w-32 h-32 bg-muted rounded-full flex items-center justify-center mb-10 mt-4">
              <Bookmark className="w-16 h-16 text-gray-500" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium text-foreground mb-2">No Result!</h2>
              <p className="text-muted-foreground text-sm">
                Oops! Looks like you haven&apos;t saved any posts yet.
              </p>
            </div>
            
          </div>
        </main>
      </div>
    </div>
  )
}
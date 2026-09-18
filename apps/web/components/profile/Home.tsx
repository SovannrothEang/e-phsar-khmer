import { SearchIcon, MapPin, LayoutGrid, List } from "lucide-react";
import { IconFilterSearch, IconBasketSearch } from "@tabler/icons-react";
import { Field } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { User } from "@/lib/user";

export default function HomeProfile({}: { user: User }) {
  return (
    <div className="bg-muted">
      <div className="max-w-7xl mx-auto pb-40 px-4 pt-1">
        <main className="max-w-7xl mx-auto">
          <div className="bg-card rounded-sm shadow-sm p-4 ">
            <div className="flex items-center gap-3">
              <Field className="flex-1">
                <InputGroup className="h-10 rounded-sm">
                  <InputGroupInput
                    id="inline-start-input"
                    placeholder="Search..."
                    className="h-10 border-gray-200 focus:ring-0"
                  />
                  <InputGroupAddon align="inline-end">
                    <SearchIcon className="text-muted-foreground w-5 h-5 mr-2" />
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <Button
                variant="outline"
                className="h-10 rounded-sm px-5 border-muted-foreground/30 text-foreground hover:text-foreground font-medium"
              >
                <IconFilterSearch className="scale-120" />
                Filter
              </Button>
            </div>
            <div className="flex items-center justify-between mt-6 px-1">
              <div className="flex items-center gap-2 text-[#00a0e9] font-medium text-sm cursor-pointer">
                <MapPin className="w-4 h-4" />
                <span>Location</span>
              </div>
              <div className="flex items-center gap-4 text-gray-400">
                <List className="w-6 h-6 cursor-pointer hover:text-gray-600 transition-colors" />
                <LayoutGrid className="w-6 h-6 cursor-pointer hover:text-gray-600 transition-colors" />
              </div>
            </div>
          </div>
        </main>
        <div className="mt-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col bg-card rounded-sm items-center p-4 pb-6 shadow-sm">
              <div className="flex items-center justify-center bg-muted rounded-full h-34 w-34 mt-6">
                <IconBasketSearch
                  className="text-muted-foreground scale-180"
                  stroke={2}
                />
              </div>
              <p className="text-lg text-foreground font-medium pt-4">
                No Result Found
              </p>
              <p className="text-muted-foreground pt-2">
                You don&apos;t have any post right now
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

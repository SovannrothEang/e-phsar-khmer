import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { categories } from "@/lib/categories";
import { IconSelector, IconSearch, IconChevronDown } from "@tabler/icons-react";
import Image from "next/image";

export default function SearchBar() {
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-1 items-center max-w-lg">
      <div className="flex w-full items-center border rounded bg-card h-[42px] focus-within:ring-1 focus-within:ring-[#00a0e9] focus-within:border-[#00a0e9] transition-all duration-100 shadow-sm">
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative flex items-center rounded-l-xs rounded-r-none bg-card text-foreground hover:bg-muted/60 h-full px-4 focus:ring-0 whitespace-nowrap text-sm w-[170px] justify-between transition-colors duration-75 cursor-pointer"
            >
              <span className="absolute left-1/2 -translate-x-1/2 truncate max-w-[115px] text-center">
                {selectedCategory}
              </span>
              <IconChevronDown className="ml-auto scale-80 text-card-foreground" />
            </Button>
            {/* <Separator orientation="vertical" /> */}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className=" w-[340px] max-h-[68vh] overflow-y-auto overflow-x-hidden p-1.5 rounded-xl border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-100"
          >
            <DropdownMenuItem
              onClick={() => setSelectedCategory("All Categories")}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer mb-1 outline-none hover:bg-muted/60"
            >
              <div className="flex w-6 justify-center">
                <IconSelector className="text-card-foreground" />
              </div>
              <span className="text-sm font-semibold text-card-foreground">
                All Categories
              </span>
            </DropdownMenuItem>
            <div className="my-1 h-px bg-border/60" />
            {categories.map((category) => (
              <div key={category.slug}>
                <DropdownMenuItem
                  onClick={() => setSelectedCategory(category.name)}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg cursor-pointer outline-none transition-all duration-75 hover:bg-muted/60"
                >
                  <Image
                    src={category.cateIcon}
                    alt={category.name}
                    width={28}
                    height={28}
                    className="object-contain"
                    unoptimized
                  />
                  <span className="text-sm font-semibold text-card-foreground ">
                    {category.name}
                  </span>
                </DropdownMenuItem>
                {category.subcategories?.map((sub) => (
                  <DropdownMenuItem
                    key={sub.slug}
                    onClick={() => setSelectedCategory(sub.name)}
                    className="flex items-center gap-3 cursor-pointer py-2 px-3 ml-9 rounded-lg outline-none transition-all duration-75 hover:bg-muted/60"
                  >
                    <Image
                      src={sub.subcate}
                      alt={sub.name}
                      width={22}
                      height={22}
                      className="object-contain"
                      unoptimized
                    />
                    <span className="text-sm text-card-foreground">
                      {sub.name}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <InputGroup className="relative flex-1 h-full rounded-xs flex items-center ">
          <InputGroupInput placeholder="What are you looking for..." />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="ghost" className="h-10  rounded-full">
              <IconSearch className="scale-125 text-muted-foreground  cursor-pointer" />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}

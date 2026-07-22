"use client"
import { reportUserOption } from "@/lib/report";
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useState, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field";
import Image from "next/image";
import { Images,X,ImagePlus } from "lucide-react";
import { User } from "@/lib/user";

interface ReportAccountProps {
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function ReportAccount({ user, open, onOpenChange }: ReportAccountProps) {

  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single ref for the hidden file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    setFiles((prev) => {
      // Append new files and limit to 24 total
      const updated = [...prev, ...selected];
      return updated.slice(0, 24);
    });

    // Clear input so same file can be uploaded if deleted
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = () => {
    if (files.length === 0) {
      alert("Please upload at least one image");
      return;
    }
    if (Object.keys(errors).length > 0) {
      alert("Please fix the errors");
      return;
    }
    setIsSubmitting(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report {user?.name?.toUpperCase() || "ACCOUNT"}</DialogTitle>
          </DialogHeader>
          <Separator className="my-1" />
          <h2 className="text-sm">Photo ({files.length}/24)</h2>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {/* Map 24 total slots */}
            {Array.from({ length: 24 }).map((_, index) => {
              const file = files[index];
              const isNextSlot = index === files.length;

              return (
                <div key={index} className="relative w-20 h-16 shrink-0">
                  {file ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt="upload"
                        fill
                        className="object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute -top-0 -right-0 bg-red-500 text-card rounded-full w-5 h-5 flex items-center justify-center z-10 shadow-sm border-none cursor-pointer"
                      >
                        <X size={12} strokeWidth={3} />
                      </Button>
                    </div>
                  ) : (
                    /* EMPTY / UPLOAD BUTTON STATE */
                    <div
                      onClick={triggerUpload}
                      className={`flex flex-col items-center justify-center w-full h-full rounded-md cursor-pointer transition-all border
                    ${isNextSlot
                          ? "bg-muted hover:bg-card/70" 
                          : "bg-muted hover:bg-card/70" 
                        }
                    `}
                    >
                      {isNextSlot ? (
                        <>
                          <Images className="w-8 h-8 text-muted-foreground " />
                          <span className="text-xs text-muted-foreground mt-1">Upload</span>
                        </>
                      ) : (
                        <ImagePlus className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <FieldGroup>
            <Field>
              <FieldLabel className="text-sm">Reason<span className="text-red-500">*</span></FieldLabel>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportUserOption.map((report) => (
                      <SelectItem key={report.reportReasonId} value={report.reportReasonId}>
                        {report.reportUserReason}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  id="message"
                  placeholder="Enter your message..."
                  className="min-h-[200px]"
                />
              </Field>
            </Field>
          </FieldGroup>
          <DialogFooter className="flex flex-row justify-between">
            <DialogClose asChild>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-sm cursor-pointer h-10  text-foreground bg-muted-foreground/10 hover:bg-muted-foreground/20 w-1/2">Cancel</Button>
            </DialogClose>
            <Button type="submit" className="rounded-sm cursor-pointer h-10 text-card bg-orange-400 hover:bg-orange-500 w-2/3">Submit</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  )
}
"use client";

import { useState, useRef } from "react";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "../ui/button";
import { X, ImagePlus, Images } from "lucide-react";
import Image from "next/image";

export default function Feedback() {
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
    <div className="min-h-screen bg-muted pb-10">
      <div className="max-w-4xl mx-auto py-6 px-2">
        <h1 className="text-2xl font-medium text-foreground">Feedback</h1>

        <div className="bg-card rounded-sm border p-4 mt-4 ">
          Give feedback about your Psakhmer experience.
        </div>
        <div className="bg-card rounded-sm border p-4 mt-3">
          <h2 className="text-base">Photo ({files.length}/24)</h2>
          <div className="border-t border-muted-foreground/20 mt-2" />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex gap-2 overflow-x-auto pb-4 mt-2 scrollbar-hide">
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
        </div>
        <div className="bg-card rounded-sm border p-4 mt-4">
          <FieldSet>
            <FieldGroup className="space-y-1">
              <Field>
                <FieldLabel>Name<span className="text-red-500">*</span></FieldLabel>
                <Input id="name" placeholder="Your Name" className="rounded-sm" />
              </Field>
              <Field>
                <FieldLabel>Phone<span className="text-red-500">*</span></FieldLabel>
                <Input id="phone" placeholder="Your Phone Number" className="rounded-sm" />
              </Field>
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input id="email" placeholder="Your Email Address" className="rounded-sm" />
              </Field>
              <Field>
                <FieldLabel>Tell us how we can improve here<span className="text-red-500">*</span></FieldLabel>
                <Textarea id="feedback" className="h-40 rounded-sm" placeholder="Your feedback helps us improve..." />
              </Field>
            </FieldGroup>
          </FieldSet>
        </div>
        <div className="bg-card rounded-sm border p-4 mt-4 text-center md:text-left">
          <p className="text-sm text-foreground">
            Thanks for taking the time to give us feedback. Though we can't review every submission, we use your input to improve the experience for everyone.
          </p>
          <Button
            type="submit"
            onClick={handleSubmit}
            // disabled={isSubmitting || files.length === 0 || Object.keys(errors).length > 0}
            className="bg-orange-500 hover:bg-orange-600 text-card rounded-sm h-10 mt-4 w-full text-sm font-medium transition-all cursor-pointer"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
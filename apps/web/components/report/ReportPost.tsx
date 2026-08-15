import { reportPostOption } from "@/lib/report";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { Post } from "@/lib/posts";

interface ReportPostProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function ReportPost({ post, open, onOpenChange }: ReportPostProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">
              Report {post?.title ? post.title.toUpperCase() : "Post"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Please provide details about why you are reporting this post.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <FieldGroup>
            <Field>
              <FieldLabel className="text-sm">
                Reason <span className="text-red-500">*</span>
              </FieldLabel>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Choose Reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {reportPostOption.map((report) => (
                      <SelectItem
                        key={report.reportReasonId}
                        value={report.reportReasonId}
                      >
                        {report.reportPostReason}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Field>
                <FieldLabel className="text-sm">Description</FieldLabel>
                <Textarea
                  id="message"
                  placeholder="Enter your message..."
                  className="h-[180px] overflow-y-auto resize-none rounded-sm"
                />
              </Field>
            </Field>
          </FieldGroup>
          <DialogFooter className="flex flex-row justify-between">
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-sm cursor-pointer h-10 text-foreground bg-muted-foreground/10 hover:bg-muted-foreground/20 w-1/3"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              className="rounded-sm cursor-pointer h-10 text-card bg-orange-400 hover:bg-orange-500 w-2/3"
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
  );
}

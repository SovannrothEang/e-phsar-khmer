'use client'

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRouter } from "@/i18n/routing";

export function ListCardSell() {

  const router = useRouter();

  return (
    <Card className="mx-auto w-full max-w-7xl bg-gradient-to-b from-blue-500 to-blue-700 text-white  rounded-sm shadow-lg">
      <CardHeader>
        <CardTitle className="text-start text-lg px-2">
          Want to see your ads here?
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-base opacity-90 px-2">
          Make some extra cash by selling this in khmer24. Go on, it's quick and easy.
        </p>
      </CardContent>
      <CardFooter className="p-3 border-none leading-relaxed ">
        <Button
          onClick={() => router.push({ pathname: '/post' })}
          size="sm"
          className="w-full bg-card rounded text-foreground px-18 py-4 text-base hover:bg-muted cursor-pointer"
        >
          Sell
        </Button>
      </CardFooter>
    </Card>
  )
}

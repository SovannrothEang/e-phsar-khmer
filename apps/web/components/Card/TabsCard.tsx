import { posts } from "@/lib/posts";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { GridCardPost } from "@/components/ads/GridCardPost";
import { GridCardSell } from "@/components/ads/GridCardSell";
import { ListCardSell } from "../ads/ListCardSell"
import { ListCardPost } from "../ads/ListCardPost"
import { IconLayoutGridFilled, IconListFilled } from '@tabler/icons-react';

export function TabsCard() {
    return (
        <Tabs defaultValue="grid" className="max-w-7xl">
            <TabsList variant={"default"}>
                <TabsTrigger value="grid"><IconLayoutGridFilled /></TabsTrigger>
                <TabsTrigger value="list"><IconListFilled /></TabsTrigger>
            </TabsList>
            <TabsContent value="grid">
                <GridCardSell />
                {posts.map((post) => (
                    <GridCardPost key={post.postId} post={post} />
                ))}
            </TabsContent>
            <TabsContent value="list">
            <ListCardSell />
                {posts.map((post) => (
                    <ListCardPost key={post.postId} post={post} />
                ))}
            </TabsContent>
        </Tabs>
    )
}

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ScrollView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from "react-native";

interface FeedScrollState {
  /** True once the scroll position is close enough to the bottom to page in. */
  atEnd: boolean;
  /** Clears the trigger so one swipe pages in exactly one batch. */
  markConsumed: () => void;
}

const FeedScrollContext = createContext<FeedScrollState | null>(null);

/** Null outside a FeedScrollView, so ListingFeed can stay renderable anywhere. */
export const useFeedScroll = () => useContext(FeedScrollContext);

/** How close to the bottom (px) starts loading the next page. */
const END_THRESHOLD = 400;

/**
 * A ScrollView for screens that render a ListingFeed: it owns the vertical
 * scroll and tells the feed when the user has reached the bottom, so pages
 * load while scrolling and never from a button.
 */
export function FeedScrollView({ onScroll, ...props }: ScrollViewProps) {
  const [atEnd, setAtEnd] = useState(false);
  const viewportHeight = useRef(0);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const distanceToEnd =
        contentSize.height - (contentOffset.y + layoutMeasurement.height);
      setAtEnd(distanceToEnd <= END_THRESHOLD);
      onScroll?.(event);
    },
    [onScroll],
  );

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      // A feed shorter than the screen has nothing to scroll, so fill it first.
      if (
        viewportHeight.current > 0 &&
        height <= viewportHeight.current + END_THRESHOLD
      ) {
        setAtEnd(true);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({ atEnd, markConsumed: () => setAtEnd(false) }),
    [atEnd],
  );

  return (
    <FeedScrollContext.Provider value={value}>
      <ScrollView
        {...props}
        onLayout={(event) => {
          viewportHeight.current = event.nativeEvent.layout.height;
          props.onLayout?.(event);
        }}
        onContentSizeChange={handleContentSizeChange}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </FeedScrollContext.Provider>
  );
}

import React, { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useAnimatedValue,
  useWindowDimensions,
  View,
} from "react-native";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fixed panel height; omit to size the panel to its content. */
  height?: number;
  children: React.ReactNode;
}

/**
 * Shared bottom sheet: the dark backdrop fades in while only the panel slides
 * up. React Native's `animationType="slide"` moves the whole overlay, which
 * made the dim layer visibly slide along with the panel (captain, 2026-11-03).
 *
 * The panel stays mounted through the closing animation so its content does
 * not blank out while sliding down.
 */
export default function BottomSheet({
  visible,
  onClose,
  height,
  children,
}: BottomSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const backdrop = useAnimatedValue(0);
  const translateY = useAnimatedValue(windowHeight);
  // Android draws behind the IME, so the panel itself has to step over it —
  // `KeyboardAvoidingView` alone leaves a bottom-anchored sheet underneath.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Mount the modal before the first open animation so the panel has something
  // to slide in. This is the supported "adjust state when a prop changes"
  // pattern; doing it from an effect caused cascading renders.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Slide out before unmounting so the close animation is visible.
  useEffect(() => {
    if (visible || !mounted) return;
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: windowHeight,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, mounted, backdrop, translateY, windowHeight]);

  // Animate in once the modal is actually on screen.
  useEffect(() => {
    if (!mounted || !visible) return;
    backdrop.setValue(0);
    translateY.setValue(windowHeight);
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0.6,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [mounted, visible, backdrop, translateY, windowHeight]);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View className="flex-1">
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "#000000", opacity: backdrop },
          ]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              bottom: keyboardHeight,
              transform: [{ translateY }],
            },
            height ? { height } : null,
          ]}
          className="max-h-[95%] overflow-hidden rounded-t-[12px] bg-white"
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

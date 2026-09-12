import { Image } from "expo-image";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useEffect, useState } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import brandMark from "../../assets/images/android-icon-foreground.png";

import { colors } from "@/theme/tokens";

type BrandShimmerVariant = "large" | "compact";

interface BrandShimmerProps {
  variant?: BrandShimmerVariant;
  label: string;
}

const sizes: Record<BrandShimmerVariant, number> = {
  large: 112,
  compact: 22,
};

export function BrandShimmer({ variant = "large", label }: BrandShimmerProps) {
  const size = sizes[variant];
  const [reduceMotion, setReduceMotion] = useState(false);
  const sweep = useSharedValue(-size);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(sweep);
      sweep.value = -size;
      return;
    }
    sweep.value = -size;
    sweep.value = withRepeat(withTiming(size * 2, { duration: 1100 }), -1, false);
    return () => cancelAnimation(sweep);
  }, [reduceMotion, size, sweep]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweep.value }, { skewX: "-18deg" }],
  }));

  return (
    <View
      accessible={variant === "large"}
      accessibilityLabel={label}
      accessibilityRole="image"
      style={[styles.container, { borderRadius: variant === "large" ? 24 : 6, height: size, width: size }]}>
      <Image source={brandMark} alt="" contentFit="contain" style={styles.image} accessible={false} />
      {!reduceMotion ? (
        <View pointerEvents="none" style={styles.sheenViewport}>
          <Animated.View style={[styles.sheen, { width: Math.max(18, size * 0.3) }, sheenStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, overflow: "hidden" },
  image: { height: "100%", width: "100%" },
  sheenViewport: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  sheen: { backgroundColor: "rgba(255, 255, 255, 0.72)", height: "100%", position: "absolute" },
});

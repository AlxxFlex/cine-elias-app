import { Image } from "expo-image";

/** The original Cine Elías aperture monogram, shared by navigation and branding. */
export function BrandLogo({ size = 42 }: { size?: number }) {
  return (
    <Image
      source={require("@/assets/cinema/mark.png")}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessibilityLabel="Cine Elías"
    />
  );
}

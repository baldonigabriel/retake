import { ImageResponse } from "next/og";

import { LOGO_R, LOGO_TILE } from "@/components/layout/logo";

/** Home-screen icon: the red mark on the card surface (DESIGN.md › Logo). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0B0C0E",
        }}
      >
        <svg viewBox="0 0 32 32" width={116} height={116}>
          <path d={LOGO_TILE} fill="#FF4655" />
          <path d={LOGO_R} fill="#0B0C0E" fillRule="evenodd" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

import { createCn } from "cn/config";

/**
 * Class merger aware of the Retake design tokens, so that e.g.
 * `text-stat-lg` (font-size) and `text-fg` (colour) don't cancel each other.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "eyebrow",
            "label",
            "table",
            "body-sm",
            "body",
            "subheading",
            "heading",
            "stat-md",
            "stat-lg",
            "hero",
          ],
        },
      ],
      "font-family": [{ font: ["stat"] }],
      rounded: [{ rounded: ["chip", "control", "card", "card-lg"] }],
      shadow: [{ shadow: ["key", "hairline", "pop", "mvp"] }],
    },
  },
});

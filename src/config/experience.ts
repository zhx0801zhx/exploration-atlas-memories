/**
 * Public, non-personal defaults for the open-source template.
 *
 * Customizers normally edit this file first, then replace the route and
 * checkpoint data in `story.ts`. Optional media stays disabled until the
 * matching files have been added under `public/custom/`.
 */
export const experienceConfig = {
  recipientName: "探索者",
  deliveryLabel: "PRIVATE DELIVERY · 2026.09.20",
  publicDemo: {
    // Keep this on in the open-source template so first-time visitors can
    // preview the whole journey without travelling to the example locations.
    // Turn it off for the recipient-facing private deployment.
    enabled: false,
  },
  chapter: {
    from: "PAST",
    to: "NEXT",
    transition: "PAST → NEXT",
    lastPage: "THE LAST PAGE OF THE PAST",
  },
  opening: {
    lead: "今天，是一场只为你展开的城市探索。",
    lines: [
      "上海的五个地点，藏着过去、现在与未来。",
      "开始时间由你决定，按下印章的那一刻，整场探索才会开启。",
    ],
    edition: "SHANGHAI · FIVE CHAPTERS EDITION",
  },
  finale: {
    transition: "THE PAST HAS BEEN KEPT · A NEW CHAPTER BEGINS",
    lines: [
      "五页故事，已经被好好收藏。",
      "过去没有错过，现在正在同行，未来也想继续参与。",
      "2026 年 9 月 20 日的探索到这里完成，下一章从今晚开始。",
    ],
    signature: "TO THE PAST, THE PRESENT, AND THE FUTURE.",
    continueLabel: "打开属于未来的一页",
  },
  optionalMedia: {
    introFilm: {
      enabled: false,
      src: "/custom/intro-film.mp4",
      poster: "/custom/intro-film-poster.jpg",
      lastFrame: "/custom/intro-film-last-frame.jpg",
      deliveryLabel: "PRIVATE DELIVERY · BIRTHDAY EXPLORATION",
    },
    backgroundMusic: {
      enabled: false,
      src: "/custom/background-music.mp3",
      volume: 0.48,
    },
  },
  cartographer: {
    enabled: true,
    // This is an event fallback, not a security boundary: static-site visitors
    // can inspect bundled source. Change it for each private deployment.
    pin: "2468",
  },
} as const;

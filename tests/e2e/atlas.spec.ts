import { expect, test, type Page } from "@playwright/test";

const MEMORY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9W1XcAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("exploration-atlas:intro-film-played-v1", "true");
    const nativeTimeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) =>
      nativeTimeout(
        handler,
        timeout === 4_650 ? 40 : timeout === 3_000 ? 30 : timeout,
        ...arguments_,
      )) as typeof window.setTimeout;
  });
});

async function openAtlas(page: Page) {
  await page.getByRole("button", { name: "开启地图" }).click();
  await expect(page.locator(".map-stage")).toBeVisible({ timeout: 7_000 });
}

async function seedProgress(page: Page, databaseName: string, progress: Record<string, unknown>) {
  await page.waitForTimeout(250);
  await page.evaluate(async ({ databaseName, progress }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("state", "readwrite");
        transaction.objectStore("state").put(progress, "progress");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, { databaseName, progress });
}

async function saveMemoryPhoto(page: Page, openButtonName: string) {
  await page.getByRole("button", { name: openButtonName }).click();
  await page.locator('input[data-role="memory-photo-picker"]').first().setInputFiles({
    name: "memory.png",
    mimeType: "image/png",
    buffer: MEMORY_PNG,
  });
  const saveButton = page.getByRole("button", { name: "保存照片并揭晓" });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
}

async function seedPhoto(page: Page, databaseName: string, photo: Record<string, unknown>) {
  await page.evaluate(async ({ databaseName, photo }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction("photos", "readwrite");
        transaction.objectStore("photos").put(photo);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, { databaseName, photo });
}

test("opens as a private 2026-09-20 experience", async ({ page }) => {
  await page.goto("/?run=e2e-private-intro");
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible();
  await expect(page.getByText("PRIVATE DELIVERY · 2026.09.20")).toBeVisible();
  await expect(page.getByText("上海的五个地点，藏着过去、现在与未来。")).toBeVisible();
  await expect(page.getByRole("link", { name: "第一次查看？进入无需定位的完整演示" })).toHaveCount(0);
  await expect(page.locator(".intro-film-overlay")).toHaveCount(0);
});

test("starts manually at the confirmed north gate with the exact first clue", async ({ page }) => {
  await page.goto("/?run=e2e-first-clue");
  await openAtlas(page);
  await expect(page.locator("image.illustrated-base-map")).toHaveAttribute(
    "href",
    "/assets/maps/shanghai-home-handdrawn-v3.jpg",
  );
  await expect(page.locator(".quest-card h2")).toContainText("第一枚未知坐标");
  await expect(page.locator(".map-stage")).toHaveAttribute("data-concealed", "true");
  await expect(page.getByText("地图尚未显影")).toBeVisible();
  await expect(page.locator(".route-path, .goal-point, .revealed-map-labels, .you-marker")).toHaveCount(0);
  await page.getByRole("button", { name: "查看线索" }).click();
  await expect(page.locator(".quest-clue")).toHaveText("是现在我们的家庭成员");
  await expect(page.locator(".map-stage")).toHaveAttribute("data-concealed", "true");
  await expect(page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" })).toBeVisible();
});

test("automatically confirms a GPS arrival after two accurate north-gate samples", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["geolocation"], { origin: new URL(baseURL!).origin });
  await context.setGeolocation({ latitude: 31.1662, longitude: 121.5003, accuracy: 18 });
  await page.goto("/?run=e2e-home-arrival");
  await openAtlas(page);
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  await context.setGeolocation({ latitude: 31.16634, longitude: 121.50053, accuracy: 15 });
  await page.waitForTimeout(150);
  await context.setGeolocation({ latitude: 31.16635, longitude: 121.50055, accuracy: 13 });
  await expect(page.getByRole("button", { name: "拍下第一站的回忆" })).toBeVisible();
  await expect(page.locator(".map-stage")).toHaveAttribute("data-concealed", "false");
  await expect(page.locator(".map-stage")).toHaveAttribute("data-map-base", "offline-illustrated");
  await expect(page.locator(".revealed-map-labels")).toBeVisible();
  await expect(page.locator(".route-path:not(.route-path-aura)")).toHaveCount(1);
  await expect(page.locator(".goal-point")).toHaveCount(1);
  await saveMemoryPhoto(page, "拍下第一站的回忆");
  await expect(page.locator(".unlock-card h2")).toContainText("关于每个女孩子的梦想");
});

test("shows the next exact clue before driving and keeps parking as an optional hint", async ({ page }) => {
  await page.goto("/?mode=fulltest&run=e2e-driving-clue");
  await seedProgress(page, "exploration-atlas-fulltest-e2e-driving-clue", {
    activeZoneId: "fulltest-home-start",
    activeCheckpointId: "fulltest-home-dream",
    completedCheckpointIds: ["fulltest-home-dream"],
    photoAttempts: {},
    capturedPhotoIds: [],
    phase: "fog",
    zoneStarted: false,
    arrivedCheckpointIds: ["fulltest-home-dream"],
  });
  await page.reload();
  await expect(page.locator(".fog-content h2")).toHaveText("你最初的过去");
  await expect(page.getByText("解出地点后，请使用正常导航自驾前往。")).toBeVisible();
  await page.getByText("需要停车提示").click({ force: true });
  await expect(page.getByText(/第二站停车点 · 请使用预先保存的导航位置/)).toBeVisible();
  await expect(page.getByText(/以当日导航和现场指引为准/)).toBeVisible();
});

test("uses a manual arrival for the adjacent fourth stop without starting GPS", async ({ page }) => {
  await page.addInitScript(() => {
    let watchCount = 0;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: () => {
          watchCount += 1;
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
    Object.defineProperty(window, "__watchCount", { get: () => watchCount });
  });
  await page.goto("/?run=e2e-lego-manual");
  await seedProgress(page, "exploration-atlas-formal-e2e-lego-manual", {
    activeZoneId: "shimao-present",
    activeCheckpointId: "lego-present",
    completedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood"],
    photoAttempts: {},
    capturedPhotoIds: [],
    phase: "map",
    zoneStarted: true,
    arrivedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood"],
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "我已走到相邻铺位" })).toBeVisible();
  await expect(page.getByText("无需再次定位")).toBeVisible();
  await page.getByRole("button", { name: "我已走到相邻铺位" }).click();
  await saveMemoryPhoto(page, "拍下第四站的回忆");
  await expect(page.locator(".unlock-card h2")).toContainText("关于我参与的现在");
  expect(await page.evaluate(() => (window as typeof window & { __watchCount: number }).__watchCount)).toBe(0);
});

test("uses entrance GPS for the final stop and waits for a fifth-floor manual reveal", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["geolocation"], { origin: new URL(baseURL!).origin });
  await context.setGeolocation({ latitude: 31.2422, longitude: 121.484, accuracy: 16 });
  await page.goto("/?run=e2e-castle");
  await seedProgress(page, "exploration-atlas-formal-e2e-castle", {
    activeZoneId: "castle-future",
    activeCheckpointId: "castle-future",
    completedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present"],
    photoAttempts: {},
    capturedPhotoIds: [],
    phase: "map",
    zoneStarted: true,
    arrivedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present"],
  });
  await page.reload();
  await context.setGeolocation({ latitude: 31.242416, longitude: 121.484422, accuracy: 14 });
  await page.waitForTimeout(150);
  await context.setGeolocation({ latitude: 31.242417, longitude: 121.484423, accuracy: 12 });
  await expect(page.getByRole("button", { name: "我已到达 5 层，拍照留念" })).toBeVisible();
  await expect(page.getByText("19:30")).toBeVisible();
  await saveMemoryPhoto(page, "我已到达 5 层，拍照留念");
  await expect(page.locator(".unlock-card h2")).toContainText("关于我想参与的未来");
});

test("walks all five reveals through the manual arrival fallbacks", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?mode=fulltest&run=e2e-complete");
  await openAtlas(page);

  const steps = [
    { mystery: "第一枚未知坐标", arrive: "定位不准？我已在第一站入口", photo: "拍下第一站的回忆", reveal: "关于每个女孩子的梦想", transition: "zone", needsStart: true },
    { mystery: "第二枚未知坐标", arrive: "定位不准？我已在第二站入口", photo: "拍下第二站的回忆", reveal: "关于我未曾参与的过去", transition: "zone", needsStart: true },
    { mystery: "第三枚未知坐标", arrive: "定位不准？我已在第三站入口", photo: "拍下第三站的回忆", reveal: "关于我守护的童心", transition: "checkpoint", needsStart: true },
    { mystery: "第四枚未知坐标", arrive: "我已走到相邻铺位", photo: "拍下第四站的回忆", reveal: "关于我参与的现在", transition: "zone", needsStart: false },
    { mystery: "第五枚未知坐标", arrive: "定位不准？我已在第五站入口", photo: "我已到达 5 层，拍照留念", reveal: "关于我想参与的未来", transition: "finale", needsStart: true },
  ] as const;

  for (const step of steps) {
    await expect(page.locator(".quest-card h2")).toContainText(step.mystery);
    if (step.needsStart) {
      await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
    }
    await page.getByRole("button", { name: step.arrive }).click();
    await saveMemoryPhoto(page, step.photo);
    await expect(page.locator(".unlock-card h2")).toContainText(step.reveal);
    if (step.transition === "checkpoint") {
      await page.getByRole("button", { name: "寻找下一枚未知坐标" }).evaluate((button: HTMLElement) => button.click());
    } else if (step.transition === "zone") {
      await page.getByRole("button", { name: "带着这一页返回飞行扫帚" }).evaluate((button: HTMLElement) => button.click());
      await expect(page.locator(".fog-content h2")).toBeVisible();
      await page.getByRole("button", { name: "我已停车，翻开下一页" }).evaluate((button: HTMLElement) => button.click());
      await expect(page.locator(".map-stage")).toBeVisible();
    } else {
      await page.getByRole("button", { name: "打开属于未来的一页" }).evaluate((button: HTMLElement) => button.click());
    }
  }

  await expect(page.getByRole("heading", { name: "Exploration Completed" })).toBeVisible();
  await expect(page.getByText("5 段照片回忆已经被地图收藏。")).toBeVisible();
  await expect(page.getByRole("button", { name: "回到第一页" })).toBeVisible();
});

test("keeps a formal finale clean and reset-free", async ({ page }) => {
  await page.goto("/?run=e2e-formal-finale");
  await seedProgress(page, "exploration-atlas-formal-e2e-formal-finale", {
    activeZoneId: "castle-future",
    activeCheckpointId: "castle-future",
    completedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present", "castle-future"],
    photoAttempts: {},
    capturedPhotoIds: [],
    phase: "finale",
    zoneStarted: false,
    arrivedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present", "castle-future"],
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Exploration Completed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "回到第一页" })).toBeVisible();
});

test("uses the bottom-right compass to return from map and fog pages", async ({ page }) => {
  await page.goto("/?run=e2e-return-home");
  await openAtlas(page);
  await page.getByRole("button", { name: "回到第一页" }).click();
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible();

  const databaseName = "exploration-atlas-formal-e2e-return-home";
  await seedProgress(page, databaseName, {
    activeZoneId: "home-start",
    activeCheckpointId: "home-dream",
    completedCheckpointIds: ["home-dream"],
    photoAttempts: {},
    capturedPhotoIds: [],
    phase: "fog",
    zoneStarted: false,
    arrivedCheckpointIds: ["home-dream"],
  });
  await page.reload();
  await expect(page.locator(".fog-screen")).toBeVisible();
  await page.getByRole("button", { name: "回到第一页" }).click();
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible();
});

test("opens every saved photo from the finale memory entrance", async ({ page }) => {
  const databaseName = "exploration-atlas-formal-e2e-memory-gallery";
  await page.goto("/?run=e2e-memory-gallery");
  await seedProgress(page, databaseName, {
    activeZoneId: "castle-future",
    activeCheckpointId: "castle-future",
    completedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present", "castle-future"],
    photoAttempts: { "home-dream": 1 },
    capturedPhotoIds: ["home-dream-memory"],
    phase: "finale",
    zoneStarted: false,
    arrivedCheckpointIds: ["home-dream", "yuyuan-past", "popmart-childhood", "lego-present", "castle-future"],
  });
  await seedPhoto(page, databaseName, {
    id: "home-dream-memory",
    checkpointId: "home-dream",
    dataUrl: `data:image/png;base64,${MEMORY_PNG.toString("base64")}`,
    score: 100,
    createdAt: Date.now(),
  });
  await page.reload();

  const memoryEntrance = page.getByRole("button", { name: "打开今日照片回忆，共 1 张" });
  await expect(memoryEntrance).toBeVisible();
  await memoryEntrance.click();
  await expect(page.getByRole("dialog", { name: "今日照片回忆" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今日照片回忆" })).toBeVisible();
  await page.getByRole("button", { name: /PAGE 01\s*步步生花/ }).click();
  await expect(page.getByAltText("步步生花的照片回忆")).toBeVisible();
  await expect(page.getByRole("button", { name: "保存或分享这张照片" })).toBeVisible();
  await page.getByRole("button", { name: "返回全部" }).click();
  await expect(page.getByRole("button", { name: /PAGE 01\s*步步生花/ })).toBeVisible();
});

test("isolates a named formal run from previously saved progress", async ({ page }) => {
  await page.goto("/?run=e2e-isolated-a");
  await openAtlas(page);
  await page.goto("/?run=e2e-isolated-b");
  await expect(page.locator(".intro-screen")).toBeVisible();
  expect(await page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name)))
    .toContain("exploration-atlas-formal-e2e-isolated-b");
});

test("recovers safely from corrupted local progress", async ({ page }) => {
  await page.goto("/?mode=fulltest&run=e2e-corrupt-progress");
  await seedProgress(page, "exploration-atlas-fulltest-e2e-corrupt-progress", {
    phase: "map",
    zoneStarted: "broken",
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "开启地图" })).toBeVisible();
});

test("location denial never blocks the manual arrival fallback", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          window.setTimeout(() => error?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 0);
          return 1;
        },
        clearWatch: () => undefined,
      },
    });
  });
  await page.goto("/?mode=fulltest&run=e2e-location-denied");
  await openAtlas(page);
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  await page.getByRole("button", { name: "查看线索" }).click();
  await expect(page.getByText("定位权限没有开启")).toBeVisible();
  await page.getByRole("button", { name: "定位不准？我已在第一站入口" }).click();
  await expect(page.getByRole("button", { name: "拍下第一站的回忆" })).toBeVisible();
});

test("keeps the revealed map draggable, zoomable and visually layered", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["geolocation"], { origin: new URL(baseURL!).origin });
  await context.setGeolocation({ latitude: 31.1662, longitude: 121.5003, accuracy: 18 });
  await page.goto("/?run=e2e-map-gestures");
  await openAtlas(page);
  await page.getByRole("button", { name: "飞行扫帚已抵达，开始探索" }).click();
  await context.setGeolocation({ latitude: 31.16634, longitude: 121.50053, accuracy: 15 });
  await page.waitForTimeout(150);
  await context.setGeolocation({ latitude: 31.16635, longitude: 121.50055, accuracy: 13 });
  await expect(page.locator(".map-stage")).toHaveAttribute("data-concealed", "false");
  await expect(page.locator(".magic-atmosphere")).toHaveAttribute("data-phase", "map");
  await expect(page.locator(".chapter-relic[data-gift='sparkle']")).toBeVisible();
  const map = page.getByLabel("可拖拽和双指缩放的探索地图");
  await map.dispatchEvent("pointerdown", { pointerId: 1, clientX: 300, clientY: 300 });
  await map.dispatchEvent("pointermove", { pointerId: 1, clientX: 350, clientY: 330 });
  await map.dispatchEvent("pointerup", { pointerId: 1, clientX: 350, clientY: 330 });
  await expect(map).toHaveAttribute("data-pan", "50,30");
  await map.dispatchEvent("pointerdown", { pointerId: 1, clientX: 300, clientY: 300 });
  await map.dispatchEvent("pointerdown", { pointerId: 2, clientX: 400, clientY: 300 });
  await map.dispatchEvent("pointermove", { pointerId: 2, clientX: 500, clientY: 300 });
  await map.dispatchEvent("pointerup", { pointerId: 2, clientX: 500, clientY: 300 });
  await map.dispatchEvent("pointerup", { pointerId: 1, clientX: 300, clientY: 300 });
  expect(Number(await map.getAttribute("data-zoom"))).toBeGreaterThan(1.2);
});

test("asks portrait iPad users to rotate", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "请将 iPad 横过来" })).toBeVisible();
});

test("stores the complete private atlas for offline use", async ({ page }) => {
  await page.goto("/?run=e2e-offline");
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Exploration Atlas" })).toBeVisible();
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some((name) => name.startsWith("exploration-atlas-"))).toBe(true);
  const offlineMaps = [
    "/assets/maps/shanghai-home-handdrawn-v3.jpg",
    "/assets/maps/shanghai-yuyuan-handdrawn-v3.jpg",
    "/assets/maps/shanghai-shimao-handdrawn-v3.jpg",
    "/assets/maps/shanghai-castle-handdrawn-v3.jpg",
  ];
  for (const map of offlineMaps) {
    expect(await page.evaluate(async (asset) => Boolean(await caches.match(asset)), map)).toBe(true);
  }
});

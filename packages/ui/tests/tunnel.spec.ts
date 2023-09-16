import { test, expect } from "@playwright/test";

test("landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Blob City/);

  await expect(page.getByTestId("hero")).toBeVisible();
  await expect(page.getByTestId("new")).toBeVisible();
  await expect(page.getByTestId("join")).toBeVisible();
});

test.describe("Peer 1", () => {
  test("can create a tunnel", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("new").click();
    await expect(page).toHaveURL(/tunnel\/new$/);

    await expect(page.getByTestId("secret")).toBeVisible();
    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByTestId("status")).toHaveText("Waiting");
  });

  test("waits for peer 2 to join", async ({ page: peer1, context }) => {
    await peer1.goto("/");

    await peer1.getByTestId("new").click();
    const secret = await peer1.getByTestId("secret").textContent();
    expect(secret).not.toBeUndefined();

    const peer2 = await context.newPage();
    await peer2.goto("/");
    await peer2.getByTestId("join").click();
    await peer2.getByTestId("secret").type(secret!);

    await expect(peer1).toHaveURL(/tunnel$/);
    await expect(peer1.getByTestId("status")).toHaveText("Ready");
    await expect(peer1.getByText(/Drop files here to stream/)).toBeVisible();
  });

  test("can transfer a file to peer 2", async ({ page: peer1, context }) => {
    await peer1.goto("/");
    await peer1.getByTestId("new").click();
    const secret = await peer1.getByTestId("secret").textContent();

    const peer2 = await context.newPage();
    await peer2.goto("/");
    await peer2.getByTestId("join").click();
    await peer2.getByTestId("secret").type(secret!);

    const filePickerPromise = peer1.waitForEvent("filechooser");
    const downloadPromise = peer2.waitForEvent("download");

    await peer1.getByTestId("upload").click();
    const fileChooser = await filePickerPromise;
    await fileChooser.setFiles({
      name: "installer.dmg",
      mimeType: "text/plain",
      buffer: Buffer.from("dmg-stuff"),
    });

    const download = await downloadPromise;
    const name = download.suggestedFilename();
    const body = await download.createReadStream().then(
      (stream) =>
        new Promise((r) => {
          let content = "";
          stream?.on("end", () => r(content));
          stream?.on("readable", () => {
            let chunk;
            while (null !== (chunk = stream.read()))
              content = content.concat(chunk);
          });
        })
    );

    expect(name).toBe("installer.dmg");
    expect(body).toBe("dmg-stuff");
  });
});

test.describe("Peer 2", () => {
  test("can join a tunnel", async ({ page: peer2, context }) => {
    const peer1 = await context.newPage();
    await peer1.goto("/");
    await peer1.getByTestId("new").click();
    const secret = await peer1.getByTestId("secret").textContent();
    expect(secret).not.toBeUndefined();

    await peer2.goto("/");
    await peer2.getByTestId("join").click();
    await expect(peer2).toHaveURL(/tunnel\/join/);
    await expect(peer2.getByTestId("toast-join")).toBeVisible();

    await peer2.getByTestId("secret").type(secret!);

    await expect(peer2).toHaveURL(/tunnel$/);
    await expect(peer2.getByTestId("status")).toHaveText("Ready");
    await expect(peer2.getByText(/Drop files here to stream/)).toBeVisible();
  });

  test.skip("rejects incorrect secrets", async () => {});

  test("can transfer a file to peer 1", async ({ page: peer2, context }) => {
    const peer1 = await context.newPage();
    await peer1.goto("/");
    // peer2.on("console", (msg) => console.log("Peer2:", msg.text()));

    await peer1.getByTestId("new").click();
    const secret = await peer1.getByTestId("secret").textContent();

    await peer2.goto("/");
    await peer2.getByTestId("join").click();
    await peer2.getByTestId("secret").type(secret!);

    const filePickerPromise = peer2.waitForEvent("filechooser");
    const downloadPromise = peer1.waitForEvent("download");

    await peer2.getByTestId("upload").click();
    const fileChooser = await filePickerPromise;
    await fileChooser.setFiles({
      name: "installer.dmg",
      mimeType: "text/plain",
      buffer: Buffer.from("dmg-stuff"),
    });

    const download = await downloadPromise;
    const name = download.suggestedFilename();
    const body = await download.createReadStream().then(
      (stream) =>
        new Promise((r) => {
          let content = "";
          stream?.on("end", () => r(content));
          stream?.on("readable", () => {
            let chunk;
            while (null !== (chunk = stream.read()))
              content = content.concat(chunk);
          });
        })
    );

    expect(name).toBe("installer.dmg");
    expect(body).toBe("dmg-stuff");
  });
});

test.skip("can reconnect", async ({ page }) => {});

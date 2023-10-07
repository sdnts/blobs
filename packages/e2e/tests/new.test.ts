import { test, expect } from "@playwright/test";

test("can create a session", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new").click();
  await expect(page.getByTestId("toast-success")).toBeVisible();
  await expect(page).toHaveURL(/.*new/);

  await expect(page.getByTestId("secret")).toBeVisible();
  await expect(page.getByTestId("toast-success")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("waiting");
});

test("waits for peer to join", async ({ page: peer1, context }) => {
  await peer1.goto("/");

  await peer1.getByTestId("new").click();
  const secret = await peer1.getByTestId("secret").textContent();
  expect(secret).not.toBeUndefined();

  const peer2 = await context.newPage();
  await peer2.goto("/");
  await peer2.getByTestId("join").click();
  await peer2.getByTestId("secret").fill(secret!);

  await expect(peer1).toHaveURL(/.*tunnel/);
  await expect(peer1.getByTestId("status")).toHaveText("ready");
});

test("can transfer a file to the other peer", async ({ page, context }) => {
  await page.goto("/");
  await page.getByTestId("new").click();
  const secret = await page.getByTestId("secret").textContent();

  const peer = await context.newPage();
  await peer.goto("/");
  await peer.getByTestId("join").click();
  await peer.getByTestId("secret").fill(secret!);

  const filePickerPromise = page.waitForEvent("filechooser");
  const downloadPromise = peer.waitForEvent("download");

  await page.getByTestId("upload").click();
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
          let chunk: string;
          while (null !== (chunk = stream.read()))
            content = content.concat(chunk);
        });
      })
  );

  expect(name).toBe("installer.dmg");
  expect(body).toBe("dmg-stuff");
});

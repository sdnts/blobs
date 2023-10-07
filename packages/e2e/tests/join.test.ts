import { test, expect } from "@playwright/test";

test("can join a session", async ({ page: peer2, context }) => {
  const peer1 = await context.newPage();
  await peer1.goto("/");
  await peer1.getByTestId("new").click();
  const secret = await peer1.getByTestId("secret").textContent();
  expect(secret).not.toBeUndefined();

  await peer2.goto("/");
  await peer2.getByTestId("join").click();
  await expect(peer2).toHaveURL(/.*join/);
  await expect(peer2.getByTestId("toast-join")).toBeVisible();

  await peer2.getByTestId("secret").fill(secret!);

  await expect(peer2).toHaveURL(/.*tunnel/);
  await expect(peer2.getByTestId("status")).toHaveText("ready");
});

test.skip("rejects incorrect secrets", async () => {});

test("can transfer a file to the other peer", async ({ page, context }) => {
  const peer = await context.newPage();
  await peer.goto("/");

  await peer.getByTestId("new").click();
  const secret = await peer.getByTestId("secret").textContent();

  await page.goto("/");
  await page.getByTestId("join").click();
  await page.getByTestId("secret").fill(secret!);

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

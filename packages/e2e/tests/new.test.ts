import { test, expect } from "@playwright/test";

test("can create a session", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("new").click();
  await expect(page.getByTestId("toast-success")).toBeVisible();
  await expect(page).toHaveURL(/\/new$/);

  await expect(page.getByTestId("secret")).toBeVisible();
  await expect(page.getByTestId("toast-success")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("Waiting");
});

test("waits for peer to join", async ({ page: peer1, context }) => {
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
});

test.skip("can transfer a file to the other peer", async ({
  page: peer1,
  context,
}) => {
  // Workerd just crashes here :/
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

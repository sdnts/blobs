import { test, expect } from "@playwright/test";

test("can join a session", async ({ page: peer2, context }) => {
  const peer1 = await context.newPage();
  await peer1.goto("/");
  await peer1.getByTestId("new").click();
  const secret = await peer1.getByTestId("secret").textContent();
  expect(secret).not.toBeUndefined();

  await peer2.goto("/");
  await peer2.getByTestId("join").click();
  await expect(peer2).toHaveURL(/\/join/);
  await expect(peer2.getByTestId("toast-join")).toBeVisible();

  await peer2.getByTestId("secret").type(secret!);

  await expect(peer2).toHaveURL(/tunnel$/);
  await expect(peer2.getByTestId("status")).toHaveText("Ready");
});

test.skip("rejects incorrect secrets", async () => {});

test.skip("can transfer a file to peer 1", async ({ page: peer2, context }) => {
  // Workerd just crashes here :/
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

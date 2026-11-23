import { expect, test, type Page } from "@playwright/test";
import { api, LANDLORD, MOBILE, readOtp, tinyPdf, WEB } from "./helpers";

/**
 * The core loop across both apps:
 * student signs up (OTP) → applies with documents → landlord sends an offer with a bed →
 * student accepts → the app switches into the residence's branded space.
 *
 * Uses its own one-bed residence so runs don't eat into the seeded data.
 */

const run = Date.now().toString(36);
const residenceName = `E2E House ${run}`;
const student = { number: `E2E${run}`.toUpperCase(), email: `e2e.${run}@myuct.ac.za`, first: "Ayanda", last: `Tester${run}` };

let landlordToken: string;
let residenceId: string;

test.beforeAll(async () => {
  ({ accessToken: landlordToken } = await api<{ accessToken: string }>("POST", "/auth/login", LANDLORD));
  const institutions = await api<{ id: string; shortName: string }[]>("GET", "/institutions");
  const uct = institutions.find((i) => i.shortName === "UCT")!;

  const residence = await api<{ id: string }>(
    "POST",
    "/landlord/residences",
    {
      name: residenceName,
      description: "Created by the end-to-end test suite.",
      type: "PRIVATE",
      addressLine: "1 Test Lane, Rondebosch",
      city: "Cape Town",
      latitude: -33.96,
      longitude: 18.47,
      primaryColour: "#B45309",
      isPublished: true,
      institutions: [{ institutionId: uct.id, distanceKm: 0.5 }],
    },
    landlordToken,
  );
  residenceId = residence.id;
  const rt = await api<{ id: string }>(
    "POST",
    `/landlord/residences/${residenceId}/room-types`,
    { name: "E2E Single", occupancy: 1, monthlyRentCents: 480000 },
    landlordToken,
  );
  await api("POST", `/landlord/room-types/${rt.id}/rooms`, { label: "E1", bedLabels: ["A"] }, landlordToken);
});

test.afterAll(async () => {
  // Hide the test residence from students browsing the dev database.
  if (residenceId) await api("PATCH", `/landlord/residences/${residenceId}`, { isPublished: false }, landlordToken);
});

async function uploadPdf(page: Page, name: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).first().click();
  await (await chooser).setFiles({ name, mimeType: "application/pdf", buffer: tinyPdf });
  await expect(page.getByText(name)).toBeVisible();
}

test("student applies, landlord offers a bed, student moves into the residence space", async ({ browser }) => {
  const mobile = await (await browser.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  mobile.on("dialog", (d) => d.accept());

  // ── Student: sign in with student number + institution email OTP ──
  await mobile.goto(MOBILE);
  await mobile.getByLabel("Your institution").fill("UCT");
  await mobile.getByText("University of Cape Town").click();
  await mobile.getByLabel("Student number").fill(student.number);
  await mobile.getByLabel("Student email").fill(student.email);
  await mobile.getByRole("button", { name: "Send code" }).click();

  await expect(mobile.getByText(`sent to`)).toBeVisible();
  await mobile.getByLabel("Verification code").fill(await readOtp(student.email));

  // ── Profile setup ──
  await mobile.getByLabel("First name").fill(student.first);
  await mobile.getByLabel("Last name").fill(student.last);
  await mobile.getByRole("button", { name: "Self-funded" }).click();
  await mobile.getByRole("button", { name: "Continue" }).click();

  // ── Discover: only UCT residences, open ours, apply ──
  await expect(mobile.getByText("The Observatory")).toBeVisible();
  await expect(mobile.getByText("Braam Heights")).toHaveCount(0); // Wits residence, hidden from UCT students
  await mobile.getByText(residenceName).click();
  await mobile.getByText("E2E Single").click();
  await mobile.getByRole("button", { name: "Start application" }).click();

  // ── Upload required documents and submit ──
  await uploadPdf(mobile, "id-document.pdf");
  await uploadPdf(mobile, "proof-of-registration.pdf");
  await mobile.getByRole("button", { name: "Submit application" }).click();
  // Status badge (a "Submitted <date>" row appears too).
  await expect(mobile.getByText("Submitted", { exact: true }).first()).toBeVisible();
  await expect(mobile.getByRole("button", { name: "Submit application" })).toHaveCount(0);

  // ── Landlord: review in the dashboard and send an offer ──
  const web = await (await browser.newContext()).newPage();
  await web.goto(`${WEB}/login`);
  await web.getByLabel("Email").fill(LANDLORD.email);
  await web.getByLabel("Password").fill(LANDLORD.password);
  await web.getByRole("button", { name: "Sign in" }).click();
  await expect(web.getByRole("heading", { name: "Overview" })).toBeVisible();

  await web.goto(`${WEB}/landlord/applications?residenceId=${residenceId}`);
  await web.getByRole("link", { name: `${student.first} ${student.last}` }).click();
  await expect(web.getByText("proof-of-registration.pdf")).toBeVisible();

  // The document opens through a presigned URL.
  const [doc] = await Promise.all([
    web.waitForEvent("popup"),
    web.getByRole("link", { name: "Open" }).first().click(),
  ]);
  await doc.waitForLoadState();
  expect(doc.url()).toContain("application-document");
  await doc.close();

  await expect(web.getByLabel("Allocate bed")).toHaveValue(/.+/);
  await web.getByRole("button", { name: "Send offer" }).click();
  await expect(web.getByText("Waiting for the student to accept the offer in the app.")).toBeVisible();
  await expect(web.getByText("Allocated room")).toContainText("E1");

  // ── Student: accept the offer → residence space ──
  await mobile.goto(`${MOBILE}/applications`);
  await mobile.getByText("You have an offer. Tap to respond.").click();
  await expect(mobile.getByText("E1 · bed A")).toBeVisible();
  await mobile.getByRole("button", { name: "Accept offer" }).click();

  await expect(mobile.getByText("Welcome to")).toBeVisible();
  await expect(mobile.getByText(residenceName)).toBeVisible();
  await expect(mobile.getByText("E1 · bed A")).toBeVisible();

  // ── Landlord: bed now shows as allocated, application as accepted ──
  await web.goto(`${WEB}/landlord/applications?residenceId=${residenceId}`);
  await expect(web.getByRole("cell", { name: "Offer accepted" })).toBeVisible();
});

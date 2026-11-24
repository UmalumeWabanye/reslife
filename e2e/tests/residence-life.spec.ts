import { expect, test, type Page } from "@playwright/test";
import { api, LANDLORD, MOBILE, readOtp, WEB } from "./helpers";

/**
 * Residence life across both apps:
 * landlord moves a student in → posts an announcement → student reads it →
 * student reports a problem with a photo → landlord assigns, replies, resolves →
 * student confirms the fix → request closes.
 *
 * Gets the student to "accepted offer" through the API so this test only drives Phase 3 UI.
 */

const run = Date.now().toString(36);
const residenceName = `E2E Life ${run}`;
const student = { number: `LIFE${run}`.toUpperCase(), email: `life.${run}@myuct.ac.za`, first: "Lerato", last: `Life${run}` };

// 1×1 PNG for the maintenance photo.
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let landlordToken: string;
let residenceId: string;
let studentTokens: { accessToken: string; refreshToken: string };

test.beforeAll(async () => {
  ({ accessToken: landlordToken } = await api<{ accessToken: string }>("POST", "/auth/login", LANDLORD));
  const uct = (await api<{ id: string; shortName: string }[]>("GET", "/institutions")).find((i) => i.shortName === "UCT")!;

  residenceId = (
    await api<{ id: string }>(
      "POST",
      "/landlord/residences",
      {
        name: residenceName,
        description: "Created by the residence-life end-to-end test.",
        type: "PRIVATE",
        addressLine: "2 Test Lane, Rondebosch",
        city: "Cape Town",
        latitude: -33.96,
        longitude: 18.47,
        primaryColour: "#0E7490",
        isPublished: true,
        institutions: [{ institutionId: uct.id, distanceKm: 0.4 }],
      },
      landlordToken,
    )
  ).id;
  const rt = await api<{ id: string }>(
    "POST",
    `/landlord/residences/${residenceId}/room-types`,
    { name: "Life Single", occupancy: 1, monthlyRentCents: 450000 },
    landlordToken,
  );
  const room = await api<{ beds: { id: string }[] }>("POST", `/landlord/room-types/${rt.id}/rooms`, { label: "L1", bedLabels: ["A"] }, landlordToken);

  // Student: OTP sign-in, profile, apply, submit (via API).
  const identity = { institutionId: uct.id, studentNumber: student.number, email: student.email };
  await api("POST", "/auth/student/otp/request", identity);
  studentTokens = await api("POST", "/auth/student/otp/verify", { ...identity, code: await readOtp(student.email) });
  const t = studentTokens.accessToken;
  const me = await api<{ id: string }>("GET", "/auth/me", undefined, t);
  await api("PATCH", "/me/profile", { firstName: student.first, lastName: student.last, fundingType: "SELF" }, t);
  const application = await api<{ id: string }>(
    "POST",
    "/applications",
    { residenceId, roomTypeId: rt.id, academicYear: new Date().getFullYear() + 1, fundingType: "SELF" },
    t,
  );
  for (const kind of ["ID_DOCUMENT", "PROOF_OF_REGISTRATION"]) {
    await api("POST", `/applications/${application.id}/documents`, { kind, fileKey: `application-document/${me.id}/e2e-${kind}.pdf`, fileName: `${kind}.pdf` }, t);
  }
  await api("POST", `/applications/${application.id}/submit`, undefined, t);

  // Landlord offers the bed; student accepts.
  await api(
    "POST",
    `/landlord/applications/${application.id}/decision`,
    { decision: "ACCEPT", bedId: room.beds[0].id, startDate: "2027-02-01", endDate: "2027-11-30" },
    landlordToken,
  );
  await api("POST", `/applications/${application.id}/respond`, { accept: true }, t);
});

test.afterAll(async () => {
  if (residenceId) await api("PATCH", `/landlord/residences/${residenceId}`, { isPublished: false }, landlordToken);
});

async function landlordPage(page: Page) {
  await page.goto(`${WEB}/login`);
  await page.getByLabel("Email").fill(LANDLORD.email);
  await page.getByLabel("Password").fill(LANDLORD.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("move-in, announcements and a maintenance request from report to closed", async ({ browser }) => {
  const web = await (await browser.newContext()).newPage();
  await landlordPage(web);

  // Student app, already signed in (tokens from the API sign-in).
  const mobileCtx = await browser.newContext({ viewport: { width: 400, height: 860 } });
  await mobileCtx.addInitScript((tokens) => {
    localStorage.setItem("auth.accessToken", tokens.accessToken);
    localStorage.setItem("auth.refreshToken", tokens.refreshToken);
  }, studentTokens);
  const mobile = await mobileCtx.newPage();
  mobile.on("dialog", (d) => d.accept());

  await mobile.goto(MOBILE);
  // Other tabs stay mounted on web, so match the home header exactly.
  await expect(mobile.getByText(residenceName, { exact: true }).first()).toBeVisible();
  await expect(mobile.getByText("Awaiting move-in")).toBeVisible();

  // ── Before move-in, maintenance is locked ──
  await mobile.goto(`${MOBILE}/maintenance`);
  await expect(mobile.getByText("Available after move-in")).toBeVisible();

  // ── Landlord moves the student in ──
  await web.goto(`${WEB}/landlord/residents?residenceId=${residenceId}`);
  const row = web.getByRole("row").filter({ hasText: `${student.first} ${student.last}` });
  await row.getByRole("button", { name: "Move in" }).click();
  await expect(row.getByText("Living here")).toBeVisible();

  // ── Landlord posts an announcement ──
  await web.goto(`${WEB}/landlord/announcements?residenceId=${residenceId}`);
  await web.getByLabel("Title").fill(`Water off Tuesday ${run}`);
  await web.getByLabel("Message").fill("Plumbers are in from 9am to 12pm. Fill a bottle the night before.");
  await web.getByLabel("Pin to top").check();
  await web.getByRole("button", { name: "Post announcement" }).click();
  await expect(web.getByText("Posted to 1 resident.")).toBeVisible();
  await expect(web.getByText("Read by 0/1")).toBeVisible();

  // ── Student: home shows updates, news can be read ──
  await mobile.goto(`${MOBILE}/home`);
  await expect(mobile.getByText(`Welcome home to ${residenceName}`)).toBeVisible();
  await mobile.goto(`${MOBILE}/news`);
  await mobile.getByText(`Water off Tuesday ${run}`).click();
  await expect(mobile.getByText("Fill a bottle the night before.")).toBeVisible();

  await web.reload();
  await expect(web.getByText("Read by 1/1")).toBeVisible();

  // ── Student reports a problem with a photo ──
  await mobile.goto(`${MOBILE}/maintenance`);
  await mobile.getByRole("button", { name: "Report a problem" }).click();
  await mobile.getByRole("button", { name: "Plumbing" }).click();
  await mobile.getByLabel("Short summary").fill(`Leaking shower ${run}`);
  await mobile.getByLabel("Details").fill("The shower head drips constantly, even when fully closed.");
  const chooser = mobile.waitForEvent("filechooser");
  await mobile.getByRole("button", { name: "Add photos" }).click();
  await (await chooser).setFiles({ name: "shower.png", mimeType: "image/png", buffer: pixel });
  await expect(mobile.getByRole("button", { name: "Remove photo 1" })).toBeVisible();
  await mobile.getByRole("button", { name: "Send request" }).click();
  await expect(mobile.getByText("Not assigned yet")).toBeVisible();
  await expect(mobile.getByRole("img", { name: "Photo 1" })).toBeVisible();

  // ── Landlord triages: assign, in progress, reply, resolve ──
  await web.goto(`${WEB}/landlord/maintenance?residenceId=${residenceId}`);
  await web.getByRole("link", { name: `Leaking shower ${run}` }).click();
  await expect(web.getByRole("img", { name: "Photo 1 of the problem" })).toBeVisible();
  await web.getByLabel("Assigned to").selectOption({ label: "Thandi Mokoena" });
  await web.getByRole("button", { name: "Save changes" }).click();
  await expect(web.getByText(/Assigned to Thandi Mokoena/)).toBeVisible();

  await web.getByLabel("Status").selectOption({ label: "→ In progress" });
  await web.getByRole("button", { name: "Save changes" }).click();
  await expect(web.getByText(/Status: In progress/)).toBeVisible();

  await web.getByLabel("Reply to the student").fill("Plumber is coming at 2pm today.");
  await web.getByRole("button", { name: "Send reply" }).click();
  await expect(web.getByText("Plumber is coming at 2pm today.")).toBeVisible();

  await web.getByLabel("Status").selectOption({ label: "→ Resolved" });
  await web.getByRole("button", { name: "Save changes" }).click();
  await expect(web.getByText("Waiting for the student to confirm it's fixed.")).toBeVisible();

  // ── Student sees the reply and confirms the fix ──
  await mobile.goto(`${MOBILE}/maintenance`);
  await mobile.getByText(`Leaking shower ${run}`).click();
  await expect(mobile.getByText("Plumber is coming at 2pm today.")).toBeVisible();
  await mobile.getByRole("button", { name: "Yes, it's fixed" }).click();
  await expect(mobile.getByText("Closed", { exact: true }).first()).toBeVisible();

  await web.reload();
  await expect(web.getByText("This request is closed.")).toBeVisible();
});

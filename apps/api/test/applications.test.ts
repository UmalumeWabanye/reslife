import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  auth,
  createInstitution,
  createLandlord,
  createResidence,
  loginPassword,
  loginStudent,
  makeApp,
} from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(() => app.close());

const YEAR = 2027;
const dates = { startDate: "2027-02-01", endDate: "2027-11-30" };

async function submittedApplication(token: string, residenceId: string, roomTypeId: string, userId?: string) {
  const created = await app.inject({
    method: "POST",
    url: "/applications",
    headers: auth(token),
    payload: { residenceId, roomTypeId, academicYear: YEAR, fundingType: "SELF" },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;

  const me = userId ?? (await app.inject({ method: "GET", url: "/auth/me", headers: auth(token) })).json().id;
  for (const kind of ["ID_DOCUMENT", "PROOF_OF_REGISTRATION"]) {
    const doc = await app.inject({
      method: "POST",
      url: `/applications/${id}/documents`,
      headers: auth(token),
      payload: { kind, fileKey: `application-document/${me}/x-${kind}.pdf`, fileName: `${kind}.pdf` },
    });
    expect(doc.statusCode).toBe(201);
  }
  const submitted = await app.inject({ method: "POST", url: `/applications/${id}/submit`, headers: auth(token) });
  expect(submitted.statusCode).toBe(200);
  return id;
}

describe("residence discovery", () => {
  it("only shows published residences of verified landlords at the student's institution", async () => {
    const instA = await createInstitution();
    const instB = await createInstitution();
    const verified = await createLandlord();
    const pending = await createLandlord({ verified: false });

    const visible = await createResidence(verified.org.id, instA.id);
    const otherInst = await createResidence(verified.org.id, instB.id);
    const unpublished = await createResidence(verified.org.id, instA.id, { published: false });
    const unverified = await createResidence(pending.org.id, instA.id);

    const student = await loginStudent(app, instA);
    const res = await app.inject({ method: "GET", url: "/residences", headers: auth(student.accessToken) });
    const ids = res.json().items.map((r: { id: string }) => r.id);

    expect(ids).toEqual([visible.id]);
    for (const hidden of [otherInst, unpublished, unverified]) {
      expect((await app.inject({ method: "GET", url: `/residences/${hidden.id}`, headers: auth(student.accessToken) })).statusCode).toBe(404);
    }
  });
});

describe("application lifecycle", () => {
  it("requires documents, can't attach someone else's file, then submits", async () => {
    const inst = await createInstitution();
    const { org } = await createLandlord();
    const res = await createResidence(org.id, inst.id);
    const student = await loginStudent(app, inst);

    const created = await app.inject({
      method: "POST",
      url: "/applications",
      headers: auth(student.accessToken),
      payload: { residenceId: res.id, roomTypeId: res.roomTypes[0].id, academicYear: YEAR, fundingType: "SELF" },
    });
    const id = created.json().id;

    const early = await app.inject({ method: "POST", url: `/applications/${id}/submit`, headers: auth(student.accessToken) });
    expect(early.json().code).toBe("MISSING_DOCUMENTS");

    const foreign = await app.inject({
      method: "POST",
      url: `/applications/${id}/documents`,
      headers: auth(student.accessToken),
      payload: { kind: "ID_DOCUMENT", fileKey: "application-document/someone-else/x.pdf", fileName: "x.pdf" },
    });
    expect(foreign.statusCode).toBe(400);
  });

  it("accept → student accepts offer → app switches to residence mode and other applications are withdrawn", async () => {
    const inst = await createInstitution();
    const { user: landlord, org } = await createLandlord();
    const resA = await createResidence(org.id, inst.id);
    const resB = await createResidence(org.id, inst.id);
    const student = await loginStudent(app, inst);
    const landlordToken = await loginPassword(app, landlord.email);

    const appA = await submittedApplication(student.accessToken, resA.id, resA.roomTypes[0].id);
    const appB = await submittedApplication(student.accessToken, resB.id, resB.roomTypes[0].id);

    const before = await app.inject({ method: "GET", url: "/me/residency", headers: auth(student.accessToken) });
    expect(before.json().mode).toBe("discover");

    const bedId = resA.roomTypes[0].rooms[0].beds[0].id;
    const decision = await app.inject({
      method: "POST",
      url: `/landlord/applications/${appA}/decision`,
      headers: auth(landlordToken),
      payload: { decision: "ACCEPT", bedId, ...dates },
    });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().lease.bedId).toBe(bedId);

    // Offer not yet accepted by the student → still discover mode.
    expect((await app.inject({ method: "GET", url: "/me/residency", headers: auth(student.accessToken) })).json().mode).toBe("discover");

    const respond = await app.inject({
      method: "POST",
      url: `/applications/${appA}/respond`,
      headers: auth(student.accessToken),
      payload: { accept: true },
    });
    expect(respond.json().status).toBe("ACCEPTED_BY_STUDENT");

    const residency = (await app.inject({ method: "GET", url: "/me/residency", headers: auth(student.accessToken) })).json();
    expect(residency.mode).toBe("residence");
    expect(residency.residence.id).toBe(resA.id);

    const other = (await app.inject({ method: "GET", url: `/applications/${appB}`, headers: auth(student.accessToken) })).json();
    expect(other.status).toBe("WITHDRAWN");
  });

  it("won't allocate the same bed twice for overlapping dates", async () => {
    const inst = await createInstitution();
    const { user: landlord, org } = await createLandlord();
    const res = await createResidence(org.id, inst.id);
    const s1 = await loginStudent(app, inst);
    const s2 = await loginStudent(app, inst);
    const token = await loginPassword(app, landlord.email);
    const bedId = res.roomTypes[0].rooms[0].beds[0].id;

    const a1 = await submittedApplication(s1.accessToken, res.id, res.roomTypes[0].id);
    const a2 = await submittedApplication(s2.accessToken, res.id, res.roomTypes[0].id);

    const [r1, r2] = await Promise.all(
      [a1, a2].map((id) =>
        app.inject({
          method: "POST",
          url: `/landlord/applications/${id}/decision`,
          headers: auth(token),
          payload: { decision: "ACCEPT", bedId, ...dates },
        }),
      ),
    );
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409]);
  });
});

describe("tenant isolation", () => {
  it("a landlord cannot see or act on another organisation's residences or applications", async () => {
    const inst = await createInstitution();
    const a = await createLandlord();
    const b = await createLandlord();
    const res = await createResidence(a.org.id, inst.id);
    const student = await loginStudent(app, inst);
    const applicationId = await submittedApplication(student.accessToken, res.id, res.roomTypes[0].id);
    const tokenB = await loginPassword(app, b.user.email);

    const list = await app.inject({ method: "GET", url: "/landlord/applications", headers: auth(tokenB) });
    expect(list.json()).toEqual([]);

    const checks = [
      { method: "GET" as const, url: `/landlord/residences/${res.id}` },
      { method: "PATCH" as const, url: `/landlord/residences/${res.id}`, payload: { name: "Hijacked" } },
      { method: "GET" as const, url: `/landlord/applications/${applicationId}` },
      {
        method: "POST" as const,
        url: `/landlord/applications/${applicationId}/decision`,
        payload: { decision: "REJECT" },
      },
    ];
    for (const c of checks) {
      const r = await app.inject({ ...c, headers: auth(tokenB) });
      expect(r.statusCode, `${c.method} ${c.url}`).toBe(404);
    }
  });

  it("students cannot use landlord routes", async () => {
    const inst = await createInstitution();
    const student = await loginStudent(app, inst);
    const r = await app.inject({ method: "GET", url: "/landlord/residences", headers: auth(student.accessToken) });
    expect(r.statusCode).toBe(403);
  });
});

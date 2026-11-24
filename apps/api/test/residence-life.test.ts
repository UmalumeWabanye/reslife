import type { FastifyInstance } from "fastify";
import { prisma } from "@students/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  auth,
  createInstitution,
  createLandlord,
  createResidence,
  loginPassword,
  loginStudent,
  makeApp,
  sentMail,
} from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(() => app.close());

/** A residence with one resident (lease created directly, pending move-in) and a landlord token. */
async function setup(beds = 2) {
  const inst = await createInstitution();
  const { user: landlord, org } = await createLandlord();
  const residence = await createResidence(org.id, inst.id, { beds });
  const student = await loginStudent(app, inst);
  const me = (await app.inject({ method: "GET", url: "/auth/me", headers: auth(student.accessToken) })).json();
  const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: me.id } });
  const lease = await prisma.lease.create({
    data: {
      studentId: profile.id,
      bedId: residence.roomTypes[0].rooms[0].beds[0].id,
      startDate: new Date("2027-02-01"),
      endDate: new Date("2027-11-30"),
      monthlyRentCents: 500000,
      fundedBy: "SELF",
    },
  });
  const landlordToken = await loginPassword(app, landlord.email);
  return { inst, org, residence, student, studentUserId: me.id as string, lease, landlordToken };
}

describe("move-in", () => {
  it("landlord moves a resident in; the residency becomes active and the student is notified", async () => {
    const s = await setup();
    const list = await app.inject({ method: "GET", url: `/landlord/leases?residenceId=${s.residence.id}`, headers: auth(s.landlordToken) });
    expect(list.json().map((l: { id: string }) => l.id)).toEqual([s.lease.id]);

    const res = await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/move-in`, headers: auth(s.landlordToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ACTIVE");

    const residency = (await app.inject({ method: "GET", url: "/me/residency", headers: auth(s.student.accessToken) })).json();
    expect(residency.lease.status).toBe("ACTIVE");
    expect(residency.lease.movedInAt).toBeTruthy();

    const notes = (await app.inject({ method: "GET", url: "/me/notifications", headers: auth(s.student.accessToken) })).json();
    expect(notes.unread).toBe(1);
    expect(notes.items[0].title).toContain("Welcome home");

    // Can't move in twice.
    const again = await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/move-in`, headers: auth(s.landlordToken) });
    expect(again.statusCode).toBe(400);
  });

  it("ending a lease sends the student back to discover mode", async () => {
    const s = await setup();
    await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/move-in`, headers: auth(s.landlordToken) });
    const end = await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/end`, headers: auth(s.landlordToken), payload: {} });
    expect(end.json().status).toBe("ENDED");
    const residency = (await app.inject({ method: "GET", url: "/me/residency", headers: auth(s.student.accessToken) })).json();
    expect(residency.mode).toBe("discover");
    const news = await app.inject({ method: "GET", url: "/residence/announcements", headers: auth(s.student.accessToken) });
    expect(news.statusCode).toBe(403);
  });
});

describe("announcements", () => {
  it("residents see their residence's news (pinned first), can mark it read, and get emailed when asked", async () => {
    const s = await setup();
    const before = sentMail.length;
    for (const [title, pinned] of [["Water off Tuesday", false], ["House rules", true]] as const) {
      const r = await app.inject({
        method: "POST",
        url: "/landlord/announcements",
        headers: auth(s.landlordToken),
        payload: { residenceId: s.residence.id, title, body: "Details here.", pinned, sendEmail: title === "Water off Tuesday" },
      });
      expect(r.statusCode).toBe(201);
      expect(r.json().recipients).toBe(1);
    }
    await new Promise((r) => setTimeout(r, 50)); // email fan-out runs after the response
    expect(sentMail.slice(before).filter((m) => m.subject.includes("Water off Tuesday"))).toHaveLength(1);

    const news = (await app.inject({ method: "GET", url: "/residence/announcements", headers: auth(s.student.accessToken) })).json();
    expect(news.map((n: { title: string }) => n.title)).toEqual(["House rules", "Water off Tuesday"]);
    expect(news.every((n: { read: boolean }) => !n.read)).toBe(true);

    await app.inject({ method: "POST", url: `/residence/announcements/${news[0].id}/read`, headers: auth(s.student.accessToken) });
    const landlordView = (await app.inject({ method: "GET", url: `/landlord/announcements?residenceId=${s.residence.id}`, headers: auth(s.landlordToken) })).json();
    const rules = landlordView.find((a: { title: string }) => a.title === "House rules");
    expect(rules.readCount).toBe(1);
    expect(rules.audience).toBe(1);
  });

  it("students at another residence don't see it, and other landlords can't post to it", async () => {
    const a = await setup();
    const b = await setup();
    await app.inject({
      method: "POST",
      url: "/landlord/announcements",
      headers: auth(a.landlordToken),
      payload: { residenceId: a.residence.id, title: "Only for A", body: "Secret" },
    });
    const bNews = (await app.inject({ method: "GET", url: "/residence/announcements", headers: auth(b.student.accessToken) })).json();
    expect(bNews.find((n: { title: string }) => n.title === "Only for A")).toBeUndefined();

    const hijack = await app.inject({
      method: "POST",
      url: "/landlord/announcements",
      headers: auth(b.landlordToken),
      payload: { residenceId: a.residence.id, title: "Hijack", body: "x" },
    });
    expect(hijack.statusCode).toBe(404);
  });
});

describe("maintenance", () => {
  const ticket = { category: "PLUMBING", title: "Leaking tap", description: "The bathroom tap drips all night." };

  it("only moved-in residents can report problems", async () => {
    const s = await setup();
    const early = await app.inject({ method: "POST", url: "/residence/maintenance", headers: auth(s.student.accessToken), payload: ticket });
    expect(early.json().code).toBe("NOT_MOVED_IN");
  });

  it("full lifecycle: report → assign → in progress → resolved → student confirms → closed", async () => {
    const s = await setup();
    await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/move-in`, headers: auth(s.landlordToken) });

    const created = await app.inject({ method: "POST", url: "/residence/maintenance", headers: auth(s.student.accessToken), payload: ticket });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(created.json().location).toBe("Room R1");

    // Landlord sees it in the open queue and can assign a team member.
    const queue = (await app.inject({ method: "GET", url: "/landlord/maintenance", headers: auth(s.landlordToken) })).json();
    expect(queue.map((q: { id: string }) => q.id)).toContain(id);
    const detail = (await app.inject({ method: "GET", url: `/landlord/maintenance/${id}`, headers: auth(s.landlordToken) })).json();
    const assigneeId = detail.staff[0].id;

    const assign = await app.inject({ method: "PATCH", url: `/landlord/maintenance/${id}`, headers: auth(s.landlordToken), payload: { assigneeId } });
    expect(assign.json().status).toBe("ASSIGNED");

    // Invalid jump is rejected.
    const bad = await app.inject({ method: "PATCH", url: `/landlord/maintenance/${id}`, headers: auth(s.landlordToken), payload: { status: "CLOSED" } });
    expect(bad.json().code).toBe("INVALID_TRANSITION");

    for (const status of ["IN_PROGRESS", "RESOLVED"]) {
      const r = await app.inject({ method: "PATCH", url: `/landlord/maintenance/${id}`, headers: auth(s.landlordToken), payload: { status } });
      expect(r.json().status).toBe(status);
    }
    await app.inject({ method: "POST", url: `/landlord/maintenance/${id}/comments`, headers: auth(s.landlordToken), payload: { body: "Washer replaced." } });

    // Student sees the thread (system entries + reply) and confirms.
    const mine = (await app.inject({ method: "GET", url: `/residence/maintenance/${id}`, headers: auth(s.student.accessToken) })).json();
    expect(mine.status).toBe("RESOLVED");
    expect(mine.comments.some((c: { body: string; isSystem: boolean }) => !c.isSystem && c.body === "Washer replaced.")).toBe(true);
    expect(mine.comments.filter((c: { isSystem: boolean }) => c.isSystem).length).toBeGreaterThanOrEqual(3);
    expect(mine.reporter).toBeUndefined();

    const confirm = await app.inject({ method: "POST", url: `/residence/maintenance/${id}/confirm`, headers: auth(s.student.accessToken), payload: { fixed: true } });
    expect(confirm.json().status).toBe("CLOSED");

    const notes = (await app.inject({ method: "GET", url: "/me/notifications", headers: auth(s.student.accessToken) })).json();
    expect(notes.items.some((n: { title: string }) => n.title.includes("Leaking tap"))).toBe(true);
  });

  it("can't assign someone outside the team, attach someone else's photo, or see another landlord's requests", async () => {
    const s = await setup();
    const other = await setup();
    await app.inject({ method: "POST", url: `/landlord/leases/${s.lease.id}/move-in`, headers: auth(s.landlordToken) });

    const foreignPhoto = await app.inject({
      method: "POST",
      url: "/residence/maintenance",
      headers: auth(s.student.accessToken),
      payload: { ...ticket, photoKeys: ["maintenance-photo/someone-else/x.jpg"] },
    });
    expect(foreignPhoto.statusCode).toBe(400);

    const id = (await app.inject({ method: "POST", url: "/residence/maintenance", headers: auth(s.student.accessToken), payload: ticket })).json().id;
    const outsider = await app.inject({
      method: "PATCH",
      url: `/landlord/maintenance/${id}`,
      headers: auth(s.landlordToken),
      payload: { assigneeId: other.studentUserId },
    });
    expect(outsider.statusCode).toBe(400);

    const peek = await app.inject({ method: "GET", url: `/landlord/maintenance/${id}`, headers: auth(other.landlordToken) });
    expect(peek.statusCode).toBe(404);
    const otherStudent = await app.inject({ method: "GET", url: `/residence/maintenance/${id}`, headers: auth(other.student.accessToken) });
    expect(otherStudent.statusCode).toBe(404);
  });
});

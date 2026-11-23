import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth, createInstitution, lastOtpFor, loginStudent, makeApp, uid } from "./helpers.js";

let app: FastifyInstance;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(() => app.close());

describe("student OTP auth", () => {
  it("rejects an email outside the institution's domains", async () => {
    const inst = await createInstitution();
    const res = await app.inject({
      method: "POST",
      url: "/auth/student/otp/request",
      payload: { institutionId: inst.id, studentNumber: "ABC123", email: "someone@gmail.com" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("EMAIL_DOMAIN_MISMATCH");
  });

  it("verifies a correct code, rejects a wrong one, and creates a verified student", async () => {
    const inst = await createInstitution();
    const identity = { institutionId: inst.id, studentNumber: `n${uid()}`, email: `a${uid()}@${inst.emailDomains[0]}` };

    expect((await app.inject({ method: "POST", url: "/auth/student/otp/request", payload: identity })).statusCode).toBe(202);

    const wrong = await app.inject({ method: "POST", url: "/auth/student/otp/verify", payload: { ...identity, code: "000000" === lastOtpFor(identity.email) ? "111111" : "000000" } });
    expect(wrong.statusCode).toBe(401);

    const ok = await app.inject({ method: "POST", url: "/auth/student/otp/verify", payload: { ...identity, code: lastOtpFor(identity.email) } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().isNewUser).toBe(true);

    const me = await app.inject({ method: "GET", url: "/auth/me", headers: auth(ok.json().accessToken) });
    expect(me.json().studentProfile.studentNumber).toBe(identity.studentNumber.toUpperCase());
    expect(me.json().studentProfile.verifiedAt).toBeTruthy();

    // Code is single-use.
    const replay = await app.inject({ method: "POST", url: "/auth/student/otp/verify", payload: { ...identity, code: lastOtpFor(identity.email) } });
    expect(replay.statusCode).toBe(401);
  });

  it("enforces a resend cooldown", async () => {
    const inst = await createInstitution();
    const identity = { institutionId: inst.id, studentNumber: `n${uid()}`, email: `c${uid()}@${inst.emailDomains[0]}` };
    await app.inject({ method: "POST", url: "/auth/student/otp/request", payload: identity });
    const again = await app.inject({ method: "POST", url: "/auth/student/otp/request", payload: identity });
    expect(again.json().code).toBe("OTP_COOLDOWN");
  });

  it("won't bind a registered student number to a different email", async () => {
    const inst = await createInstitution();
    const student = await loginStudent(app, inst);
    const res = await app.inject({
      method: "POST",
      url: "/auth/student/otp/request",
      payload: { institutionId: inst.id, studentNumber: student.studentNumber, email: `imposter${uid()}@${inst.emailDomains[0]}` },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("IDENTITY_MISMATCH");
  });
});

describe("refresh tokens", () => {
  it("rotates, and revokes all sessions when a rotated token is reused", async () => {
    const inst = await createInstitution();
    const { refreshToken } = await loginStudent(app, inst);

    const first = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    expect(first.statusCode).toBe(200);
    const next = first.json().refreshToken;

    const reuse = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });
    expect(reuse.statusCode).toBe(401);

    // The token issued by the legit rotation is revoked too.
    const after = await app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken: next } });
    expect(after.statusCode).toBe(401);
  });
});

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEV_PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // ─── Institutions ───
  const uct = await prisma.institution.upsert({
    where: { name: "University of Cape Town" },
    update: {},
    create: {
      name: "University of Cape Town",
      shortName: "UCT",
      emailDomains: ["myuct.ac.za"],
      city: "Cape Town",
      campuses: { create: [{ name: "Upper Campus", latitude: -33.9577, longitude: 18.4612 }] },
    },
  });

  const admin = await prisma.institution.upsert({
    where: { name: "University of Cape Town" },
    update: {},
    create: {
      name: "University of Cape Town",
      shortName: "UCT",
      emailDomains: ["myadmin@gmail.com"],
      city: "Cape Town",
      campuses: { create: [{ name: "Upper Campus", latitude: -33.9577, longitude: 18.4612 }] },
    },
  });

  const wits = await prisma.institution.upsert({
    where: { name: "University of the Witwatersrand" },
    update: {},
    create: {
      name: "University of the Witwatersrand",
      shortName: "Wits",
      emailDomains: ["students.wits.ac.za"],
      city: "Johannesburg",
      campuses: { create: [{ name: "Braamfontein East", latitude: -26.1929, longitude: 28.0305 }] },
    },
  });

  // ─── Users ───
  await prisma.user.upsert({
    where: { email: "admin@resplatform.local" },
    update: {},
    create: { email: "admin@resplatform.local", role: "SUPER_ADMIN", firstName: "Platform", lastName: "Admin", passwordHash },
  });

  const landlord = await prisma.user.upsert({
    where: { email: "landlord@campusliving.local" },
    update: {},
    create: { email: "landlord@campusliving.local", role: "LANDLORD_OWNER", firstName: "Thandi", lastName: "Mokoena", passwordHash },
  });

  const org =
    (await prisma.organisation.findFirst({ where: { name: "Campus Living Co." } })) ??
    (await prisma.organisation.create({
      data: {
        name: "Campus Living Co.",
        contactEmail: "landlord@campusliving.local",
        status: "VERIFIED",
        members: { create: { userId: landlord.id } },
      },
    }));

  // ─── Residences ───
  const residences = [
    {
      slug: "the-observatory",
      name: "The Observatory",
      type: "PRIVATE" as const,
      nsfasAccredited: true,
      city: "Cape Town",
      addressLine: "12 Lower Main Rd, Observatory",
      latitude: -33.9389,
      longitude: 18.4728,
      primaryColour: "#0F766E",
      institution: uct.id,
      distanceKm: 3.1,
      amenities: ["Wi-Fi", "Laundry", "Study rooms", "24h security", "Gym"],
      roomTypes: [
        { name: "Single en-suite", occupancy: 1, monthlyRentCents: 650000, rooms: ["A101", "A102", "A103"] },
        { name: "2-sharing", occupancy: 2, monthlyRentCents: 420000, rooms: ["B201", "B202"] },
      ],
    },
    {
      slug: "rondebosch-commons",
      name: "Rondebosch Commons",
      type: "COMMUNAL" as const,
      bursaryFunded: true,
      city: "Cape Town",
      addressLine: "4 Belmont Rd, Rondebosch",
      latitude: -33.9605,
      longitude: 18.4723,
      primaryColour: "#7C3AED",
      institution: uct.id,
      distanceKm: 1.2,
      amenities: ["Wi-Fi", "Shared kitchen", "Backup power"],
      roomTypes: [{ name: "4-sharing communal", occupancy: 4, monthlyRentCents: 310000, rooms: ["C1", "C2"] }],
    },
    {
      slug: "braam-heights",
      name: "Braam Heights",
      type: "PRIVATE" as const,
      nsfasAccredited: true,
      city: "Johannesburg",
      addressLine: "88 Jorissen St, Braamfontein",
      latitude: -26.1932,
      longitude: 28.0365,
      primaryColour: "#DC2626",
      institution: wits.id,
      distanceKm: 0.6,
      amenities: ["Wi-Fi", "Shuttle", "Laundry", "Biometric access"],
      roomTypes: [{ name: "Single", occupancy: 1, monthlyRentCents: 590000, rooms: ["101", "102", "103", "104"] }],
    },
  ];

  for (const r of residences) {
    const existing = await prisma.residence.findUnique({ where: { slug: r.slug } });
    if (existing) continue;
    await prisma.residence.create({
      data: {
        organisationId: org.id,
        slug: r.slug,
        name: r.name,
        description: `${r.name} offers safe, modern student living close to campus.`,
        type: r.type,
        nsfasAccredited: r.nsfasAccredited ?? false,
        bursaryFunded: r.bursaryFunded ?? false,
        addressLine: r.addressLine,
        city: r.city,
        latitude: r.latitude,
        longitude: r.longitude,
        amenities: r.amenities,
        primaryColour: r.primaryColour,
        isPublished: true,
        institutions: { create: { institutionId: r.institution, distanceKm: r.distanceKm } },
        roomTypes: {
          create: r.roomTypes.map((rt) => ({
            name: rt.name,
            occupancy: rt.occupancy,
            monthlyRentCents: rt.monthlyRentCents,
            depositCents: rt.monthlyRentCents,
            rooms: {
              create: rt.rooms.map((label) => ({
                label,
                beds: { create: Array.from({ length: rt.occupancy }, (_, i) => ({ label: String.fromCharCode(65 + i) })) },
              })),
            },
          })),
        },
      },
    });
  }

  // ─── Sample verified student ───
  await prisma.user.upsert({
    where: { email: "sipho.student@myuct.ac.za" },
    update: {},
    create: {
      email: "sipho.student@myuct.ac.za",
      role: "STUDENT",
      firstName: "Sipho",
      lastName: "Dlamini",
      studentProfile: {
        create: { institutionId: uct.id, studentNumber: "DLMSIP001", fundingType: "NSFAS", verifiedAt: new Date() },
      },
    },
  });

  console.log("Seed complete. Dev password for landlord/admin:", DEV_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

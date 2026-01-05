import { prisma } from "../src/lib/prisma.js";

async function main() {
  const invites = await prisma.invite.findMany({
    where: { patientName: "Test Patient E2E" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      id: true,
      patientName: true,
      status: true,
      claimedAt: true,
      claimedBy: { select: { name: true } },
    },
  });

  console.log("=== Invite Status Check ===");
  if (invites.length === 0) {
    console.log("No invites found for 'Test Patient E2E'");
  } else {
    for (const invite of invites) {
      console.log(`Patient: ${invite.patientName}`);
      console.log(`Status: ${invite.status}`);
      console.log(`Claimed At: ${invite.claimedAt}`);
      console.log(`Claimed By: ${invite.claimedBy?.name || "N/A"}`);
      console.log("---");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

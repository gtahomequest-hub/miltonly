import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendSMS } from "@/lib/smsAlert";

export async function POST(request: NextRequest) {
  const adminCookie = request.cookies.get("miltonly_admin");
  if (adminCookie?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { streetSlug, description } = await request.json();
  if (!streetSlug || !description) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const updated = await prisma.streetContent.update({
    where: { streetSlug },
    data: {
      description,
      status: "published",
      needsReview: false,
      publishedAt: new Date(),
    },
  });

  // This is the ONLY place revalidatePath is called
  revalidatePath(`/streets/${streetSlug}`);

  await sendSMS(
    `\u2713 Published: ${updated.streetName} \u2014 miltonly.com/streets/${streetSlug}`
  );

  return NextResponse.json({ ok: true, streetSlug });
}

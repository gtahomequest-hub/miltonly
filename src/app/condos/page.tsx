import { redirect } from "next/navigation";

export default function CondosPage() {
  redirect("/listings?type=Condo");
}

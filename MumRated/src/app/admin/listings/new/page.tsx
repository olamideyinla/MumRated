import { db } from "@/lib/db";
import ListingForm from "../ListingForm";

export const metadata = { title: "New Listing — Admin" };

export default async function NewListingPage() {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#3B2010] mb-6">New listing</h1>
      <ListingForm categories={categories} />
    </div>
  );
}

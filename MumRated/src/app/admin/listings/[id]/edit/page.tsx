import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import ListingForm from "../../ListingForm";

export const metadata = { title: "Edit Listing — Admin" };

export default async function EditListingPage({
  params,
}: {
  params: { id: string };
}) {
  const [listing, categories] = await Promise.all([
    db.listing.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        categoryId: true,
        description: true,
        brandOrProvider: true,
        locationText: true,
        priceRangeNGN: true,
        priceRangeMin: true,
        priceRangeMax: true,
        heroImage: true,
      },
    }),
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  if (!listing) notFound();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#3B2010] mb-6">
        Edit listing: {listing.name}
      </h1>
      <ListingForm listing={listing} categories={categories} />
    </div>
  );
}

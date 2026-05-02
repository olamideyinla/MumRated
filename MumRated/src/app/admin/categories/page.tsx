import { db } from "@/lib/db";
import CategoryEditor from "./CategoryEditor";

export const metadata = { title: "Categories — Admin" };

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    include: { _count: { select: { listings: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#3B2010] mb-6">Categories</h1>
      <CategoryEditor categories={categories} />
    </div>
  );
}

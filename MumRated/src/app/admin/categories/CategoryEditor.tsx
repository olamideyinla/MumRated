"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  type: string;
  parentId: string | null;
  _count: { listings: number };
}

interface Props {
  categories: Category[];
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CategoryForm({
  initial,
  categories,
  onDone,
}: {
  initial?: Category;
  categories: Category[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initial);
  const [type, setType] = useState(initial?.type ?? "PRODUCT");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");

  function handleNameChange(v: string) {
    setName(v);
    if (!slugManuallyEdited) setSlug(toSlug(v));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const method = initial ? "PATCH" : "POST";
        const body = {
          id: initial?.id,
          name,
          slug,
          type,
          parentId: parentId || null,
        };

        const res = await fetch("/api/admin/category", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Failed to save category.");
          return;
        }

        router.refresh();
        onDone();
      } catch {
        setError("Network error.");
      }
    });
  }

  const inputCls =
    "w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7B1818]/30";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Name *
          </label>
          <input
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Slug *
          </label>
          <input
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugManuallyEdited(true);
            }}
            className={inputCls}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Type *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={inputCls}
          >
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Parent category
          </label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={inputCls}
          >
            <option value="">None (top-level)</option>
            {categories
              .filter((c) => c.id !== initial?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[#7B1818] text-white px-4 py-1.5 text-sm hover:bg-[#6a1515] disabled:opacity-50 transition"
        >
          {isPending ? "Saving…" : initial ? "Save" : "Create"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CategoryEditor({ categories }: Props) {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(cat: Category) {
    if (cat._count.listings > 0) {
      setDeleteError(
        `"${cat.name}" has ${cat._count.listings} listing(s). Move or delete them first.`,
      );
      return;
    }
    if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`))
      return;

    setDeleteError(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/category", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cat.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data.error ?? "Delete failed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      {deleteError && (
        <div className="mb-4 rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {deleteError}
          <button
            onClick={() => setDeleteError(null)}
            className="ml-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      {showAddForm ? (
        <div className="mb-6 rounded-lg border border-dashed border-gray-300 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            New category
          </h3>
          <CategoryForm
            categories={categories}
            onDone={() => setShowAddForm(false)}
          />
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-6 rounded border border-dashed border-[#7B1818] text-[#7B1818] px-4 py-2 text-sm hover:bg-[#7B1818]/5 transition"
        >
          + Add category
        </button>
      )}

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Listings</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) => (
              <>
                <tr key={cat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {cat.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                    {cat.slug}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{cat.type}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {cat._count.listings}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() =>
                          setEditingId(editingId === cat.id ? null : cat.id)
                        }
                        className="text-xs text-gray-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={isPending}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === cat.id && (
                  <tr key={`${cat.id}-edit`}>
                    <td colSpan={5} className="px-4 py-4 bg-blue-50">
                      <CategoryForm
                        initial={cat}
                        categories={categories}
                        onDone={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

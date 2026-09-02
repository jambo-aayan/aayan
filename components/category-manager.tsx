import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import styles from "./category-manager.module.css";

type Category = { id: string; name: string; parentId: string | null };

/** Read-only view of the fixed, system-managed category hierarchy (#175)
 * — Settings no longer offers Add/Rename/Merge; the taxonomy only
 * changes by editing lib/finance/categories.ts's CATEGORY_HIERARCHY and
 * writing a matching migration (see ADR-0015's #173 addendum). A plain
 * server component, not "use client" — nothing here is interactive. */
export function CategoryManager({ categories }: { categories: Category[] }) {
  const parents = categories.filter((c) => c.parentId === null).sort((a, b) => a.name.localeCompare(b.name));
  const childrenByParentId = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parentId === null) continue;
    const siblings = childrenByParentId.get(c.parentId) ?? [];
    siblings.push(c);
    childrenByParentId.set(c.parentId, siblings);
  }

  if (parents.length === 0) return <EmptyState icon={Tags} message="No categories yet." />;

  return (
    <>
      <p className={styles.note}>A fixed set — transactions are categorized into these automatically.</p>
      <ul className={styles.list}>
        {parents.map((parent) => {
          const children = (childrenByParentId.get(parent.id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
          return (
            <li key={parent.id} className={styles.row}>
              <span className={styles.name}>{parent.name}</span>
              {children.length > 0 && (
                <ul className={styles.subList}>
                  {children.map((child) => (
                    <li key={child.id} className={styles.subItem}>
                      {child.name}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

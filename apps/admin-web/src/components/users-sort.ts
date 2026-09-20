const ids = ["email", "createdAt"] as const;

export type UserSortId = (typeof ids)[number];

export function nextUserSort(
    current: { id: string; desc: boolean }[],
    next: { id: string; desc: boolean }[],
): { sort: UserSortId; order: "asc" | "desc" } {
    const col = next[0];
    const id = ids.find((s) => s === col?.id);
    if (col && id) return { sort: id, order: col.desc ? "desc" : "asc" };
    const cur = current[0];
    if (cur?.id === "createdAt") {
        return { sort: "createdAt", order: cur.desc ? "asc" : "desc" };
    }
    return { sort: "createdAt", order: "desc" };
}

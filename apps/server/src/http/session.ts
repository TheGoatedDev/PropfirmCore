export function roleOf(user: { role?: string | null }): string {
    return user.role ?? "trader";
}

export function actorOf(user: { id: string; role?: string | null }) {
    return { id: user.id, role: roleOf(user) };
}

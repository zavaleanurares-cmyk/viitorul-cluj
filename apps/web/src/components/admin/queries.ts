import { formatDateTime, isMinor, unwrap, type AppContext, type AppRole, type Db } from "@club/shared";

export type AccountState = "active" | "invited" | "disabled" | "anonymized";

export type AccountRow = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  state: AccountState;
  groupIds: string[];
  player: { id: string; displayName: string } | null;
  /** deja formatată în fusul clubului; null = nu s-a autentificat niciodată */
  lastSignIn: string | null;
  inviteExpires: string | null;
  isSelf: boolean;
};

export type PlayerOption = {
  id: string;
  displayName: string;
  fullName: string;
  groupId: string | null;
  minor: boolean | null;
  /** adresa din datele de contact: a părintelui la minori, a jucătorului la adulți */
  suggestedEmail: string;
};

/** Conturile clubului, cu starea lor de autentificare, și jucătorii activi care nu au încă un cont. */
export async function loadAccounts(db: Db, ctx: AppContext): Promise<{ accounts: AccountRow[]; withoutAccount: PlayerOption[] }> {
  const [profiles, staffGroups, players, contacts, auth] = await Promise.all([
    db.from("profiles").select("id, full_name, email, role, is_active, must_change_password").order("full_name"),
    db.from("staff_groups").select("user_id, group_id"),
    db.from("players").select("id, display_name, full_name, user_id, group_id, birth_date, is_active, anonymized_at").order("display_name"),
    db.from("player_contacts").select("player_id, email, guardian_email"),
    db.rpc("admin_accounts"),
  ]);
  const authById = new Map(unwrap(auth).map((a) => [a.user_id, a]));
  const playerByUser = new Map(unwrap(players).filter((p) => p.user_id).map((p) => [p.user_id!, p]));
  const contactByPlayer = new Map((contacts.data ?? []).map((c) => [c.player_id, c]));
  const groupsByUser = new Map<string, string[]>();
  for (const sg of staffGroups.data ?? []) groupsByUser.set(sg.user_id, [...(groupsByUser.get(sg.user_id) ?? []), sg.group_id]);

  const accounts: AccountRow[] = unwrap(profiles).map((p) => {
    const a = authById.get(p.id);
    const player = playerByUser.get(p.id);
    const state: AccountState = a?.anonymized ? "anonymized"
      : !p.is_active || a?.disabled ? "disabled"
      : !a?.has_password || p.must_change_password ? "invited"
      : "active";
    return {
      id: p.id,
      fullName: p.full_name,
      email: p.email ?? "",
      role: p.role,
      state,
      groupIds: groupsByUser.get(p.id) ?? [],
      player: player ? { id: player.id, displayName: player.display_name } : null,
      lastSignIn: a?.last_sign_in_at ? formatDateTime(a.last_sign_in_at, ctx.settings.timezone) : null,
      inviteExpires: a?.invite_expires_at ? formatDateTime(a.invite_expires_at, ctx.settings.timezone) : null,
      isSelf: p.id === ctx.userId,
    };
  });

  const withoutAccount: PlayerOption[] = unwrap(players)
    .filter((p) => !p.user_id && p.is_active && !p.anonymized_at)
    .map((p) => {
      const minor = isMinor(p.birth_date, ctx.today);
      const c = contactByPlayer.get(p.id);
      return {
        id: p.id,
        displayName: p.display_name,
        fullName: p.full_name,
        groupId: p.group_id,
        minor,
        suggestedEmail: (minor ? c?.guardian_email || c?.email : c?.email || c?.guardian_email) ?? "",
      };
    });
  return { accounts, withoutAccount };
}

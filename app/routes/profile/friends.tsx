import { NavLink } from "react-router";
import { normalizeEmail } from "./profile-shared";
import { useProfileOutlet } from "./profile-context";

export default function ProfileFriendsPage() {
  const {
    friendEmail,
    setFriendEmail,
    sendFriendRequest,
    acceptedFriends,
    incomingRequests,
    outgoingRequests,
    busy,
    respondRequest,
    cancelOutgoingFriendRequest,
    removeFriendship,
    allTimeFriendStatsByEmail,
    inputClass,
  } = useProfileOutlet();

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[#372C16] bg-guinness-brown/35 p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="type-card-title">Friends & invites</h2>
            <p className="type-meta mt-2 text-guinness-tan/75">
              Invite people by email from here. If they create an account later with that same email,
              they&apos;ll see the pending friend request and any competition invites. They still
              choose whether to accept the friendship or join the competition.
            </p>
          </div>
          <div className="grid w-full gap-3 lg:max-w-xl lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              placeholder="friend@email.com"
              className={inputClass}
              autoComplete="email"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void sendFriendRequest()}
              className="min-h-11 rounded-lg bg-guinness-gold px-5 py-2.5 font-semibold text-guinness-black hover:bg-guinness-tan disabled:opacity-50 lg:min-w-[10rem]"
            >
              Send request
            </button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Friends",
              value: acceptedFriends.length,
              to: "/profile/friends#your-friends",
            },
            {
              label: "Incoming",
              value: incomingRequests.length,
              to: "/profile/friends#incoming",
            },
            {
              label: "Pending",
              value: outgoingRequests.length,
              to: "/profile/friends#pending-sent",
            },
          ].map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className="rounded-xl border border-[#372C16] bg-guinness-black/30 px-4 py-3 text-left transition-colors hover:border-guinness-gold/35 hover:bg-guinness-brown/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-guinness-gold"
              aria-label={`${item.label}: ${item.value}. Jump to ${item.label} on this page.`}
            >
              <p className="type-meta text-guinness-tan/65">{item.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-guinness-gold">{item.value}</p>
            </NavLink>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        {incomingRequests.length > 0 ? (
          <div
            id="incoming"
            className="scroll-mt-6 rounded-xl border border-[#372C16] bg-guinness-brown/30 p-5"
          >
            <h2 className="type-card-title">Incoming requests</h2>
            <ul className="mt-4 space-y-3">
              {incomingRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border border-guinness-gold/10 bg-guinness-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-guinness-cream">
                      {r.from_email || "Someone wants to connect"}
                    </p>
                    <p className="type-meta mt-1 text-guinness-tan/65">
                      Sent {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respondRequest(r, "accepted")}
                      className="rounded-lg bg-guinness-gold px-3 py-2 text-xs font-semibold text-guinness-black"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respondRequest(r, "declined")}
                      className="rounded-lg border border-guinness-gold/25 px-3 py-2 text-xs font-semibold text-guinness-tan"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          id="your-friends"
          className="scroll-mt-6 rounded-xl border border-[#372C16] bg-guinness-brown/30 p-5"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="type-card-title">Your friends</h2>
              <p className="type-meta mt-1 text-guinness-tan/70">
                Accepted friends appear here with a quick performance snapshot.
              </p>
            </div>
            <p className="type-meta text-guinness-tan/55">{acceptedFriends.length} accepted</p>
          </div>
          {acceptedFriends.length > 0 ? (
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {acceptedFriends.map((f) => {
                const email = f.peer_email ? normalizeEmail(f.peer_email) : null;
                const stats = email ? allTimeFriendStatsByEmail[email] : null;
                return (
                  <li
                    key={`${f.user_id}-${f.friend_user_id}`}
                    className="rounded-xl border border-guinness-gold/10 bg-guinness-black/30 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-guinness-cream">
                          {stats?.label ||
                            f.peer_email ||
                            `Player ${f.friend_user_id.slice(0, 8)}…`}
                        </p>
                        <p className="type-meta mt-1 truncate text-guinness-tan/60">
                          {f.peer_email || "No email linked yet"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeFriendship(f)}
                        className="shrink-0 rounded-lg border border-red-400/35 px-3 py-1.5 text-xs font-semibold text-red-400/90 hover:bg-red-950/25"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                        <p className="type-meta text-guinness-tan/55">Pours</p>
                        <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                          {stats?.pours ?? 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                        <p className="type-meta text-guinness-tan/55">Avg</p>
                        <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                          {stats ? stats.avg.toFixed(2) : "—"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-guinness-brown/35 px-3 py-2">
                        <p className="type-meta text-guinness-tan/55">Best</p>
                        <p className="mt-1 text-base font-semibold tabular-nums text-guinness-gold">
                          {stats ? stats.best.toFixed(2) : "—"}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="type-meta mt-4 text-guinness-tan/70">
              No accepted friends yet. Send a few requests above.
            </p>
          )}
        </div>

        <div
          id="pending-sent"
          className="scroll-mt-6 rounded-xl border border-[#372C16] bg-guinness-brown/30 p-5"
        >
          <h2 className="type-card-title">Pending sent</h2>
          {outgoingRequests.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {outgoingRequests.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 rounded-xl border border-guinness-gold/10 bg-guinness-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-guinness-cream">
                      {String(r.to_email)}
                    </p>
                    <p className="type-meta mt-1 text-guinness-tan/65">
                      Sent {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelOutgoingFriendRequest(r)}
                    className="shrink-0 rounded-lg border border-guinness-gold/25 px-3 py-2 text-xs font-semibold text-guinness-tan hover:bg-guinness-brown/45"
                  >
                    Cancel invite
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-meta mt-4 text-guinness-tan/70">No pending requests right now.</p>
          )}
        </div>
      </section>
    </div>
  );
}

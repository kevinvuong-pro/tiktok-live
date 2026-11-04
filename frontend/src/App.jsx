import { useMemo, useState } from "react";
import {
  Radio,
  Activity,
  Users,
  Heart,
  MessageCircle,
  Gift,
  Share2,
  Wifi,
  Power,
  Search,
  Trash2,
  Menu,
  X,
  Zap,
  Clock,
  Eye,
  Copy,
  Code2,
  LayoutDashboard,
  Signal,
  RefreshCw,
} from "lucide-react";

import { useLiveSocket } from "./hooks/useLiveSocket";

// ========================================
// HELPERS
// ========================================

function getUsername(value) {
  const input = value.trim();
  if (!input) return "";

  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);

      if (
        url.hostname !== "tiktok.com" &&
        !url.hostname.endsWith(".tiktok.com")
      )
        return "";

      return url.pathname.match(/^\/@([^/]+)/)?.[1] || "";
    } catch {
      return "";
    }
  }

  const username = input.replace(/^@/, "");
  return /^[a-zA-Z0-9._]+$/.test(username) ? username : "";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatTime(timestamp) {
  if (!timestamp) return "--:--:--";

  return new Date(timestamp).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getEventUser(data) {
  return (
    data?.user?.uniqueId ||
    data?.user?.nickname ||
    data?.user?.displayId ||
    data?.uniqueId ||
    data?.nickname ||
    data?.displayId ||
    data?.sender?.uniqueId ||
    data?.sender?.nickname ||
    "TikTok User"
  );
}

function getEventDescription(event) {
  const data = event?.data || {};
  const type = String(event?.type || "").toLowerCase();

  const firstValue = (...values) =>
    values.find(
      (value) => value !== undefined && value !== null && value !== "",
    );

  const giftName = firstValue(
    data.giftDetails?.giftName,
    data.giftDetails?.name,
    data.giftName,
    data.gift?.name,
    data.giftId,
  );

  switch (type) {
    case "chat":
      return firstValue(
        data.comment,
        data.content,
        data.text,
        "Đã gửi bình luận",
      );

    case "gift": {
      const count = Number(firstValue(data.repeatCount, data.giftCount, 1));

      const name = giftName || "một món quà";

      return `Đã tặng ${name}${count > 1 ? ` × ${count}` : ""}`;
    }

    case "like": {
      const count = firstValue(data.likeCount, data.totalLikeCount, data.count);

      return count
        ? `Đã thả ${formatNumber(count)} lượt thích`
        : "Đã thả tim LIVE";
    }

    case "member":
      return "Đã tham gia LIVE";

    case "follow":
      return "Đã theo dõi";

    case "share":
      return "Đã chia sẻ LIVE";

    case "subscribe":
      return "Đã đăng ký thành viên";

    case "social": {
      const action = data.displayType || data.label || "";

      return action ? `Hoạt động: ${action}` : "Tương tác xã hội";
    }

    case "roomuser":
    case "room_user":
      return "Cập nhật thông tin người xem";

    case "emote":
      return `Đã gửi biểu cảm ${firstValue(data.emoteId, "")}`;

    case "question":
      return firstValue(
        data.questionDetails?.content,
        data.content,
        "Đã gửi câu hỏi",
      );

    case "envelope":
      return "Đã gửi lì xì";

    case "linkmicbattle":
    case "link_mic_battle":
      return "Sự kiện PK LIVE";

    case "poll":
      return firstValue(data.title, data.question, "Cập nhật bình chọn");

    case "goal":
      return "Cập nhật mục tiêu LIVE";

    case "liveintro":
    case "live_intro":
      return "Thông tin giới thiệu LIVE";

    case "streamend":
    case "stream_end":
      return "LIVE đã kết thúc";

    default: {
      const readableType = String(event?.type || "unknown")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]/g, " ")
        .trim();

      return `Sự kiện: ${readableType}`;
    }
  }
}

function normalizeEventType(type) {
  return String(type || "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[-\s]/g, "_")
    .toLowerCase();
}

function getEventStyle(type) {
  const normalizedType = normalizeEventType(type || "event");

  const styles = {
    chat: {
      icon: MessageCircle,
      color: "text-sky-400",
      bg: "bg-sky-400/10",
      label: "CHAT",
    },
    gift: {
      icon: Gift,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      label: "GIFT",
    },
    like: {
      icon: Heart,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
      label: "LIKE",
    },
    member: {
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      label: "MEMBER",
    },
    follow: {
      icon: Users,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      label: "FOLLOW",
    },
    share: {
      icon: Share2,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      label: "SHARE",
    },
    subscribe: {
      icon: Users,
      color: "text-yellow-400",
      bg: "bg-yellow-400/10",
      label: "SUBSCRIBE",
    },
    social: {
      icon: Users,
      color: "text-teal-400",
      bg: "bg-teal-400/10",
      label: "SOCIAL",
    },
    emote: {
      icon: Heart,
      color: "text-pink-300",
      bg: "bg-pink-300/10",
      label: "EMOTE",
    },
    question: {
      icon: MessageCircle,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      label: "QUESTION",
    },
    envelope: {
      icon: Gift,
      color: "text-red-400",
      bg: "bg-red-400/10",
      label: "ENVELOPE",
    },
    poll: {
      icon: Activity,
      color: "text-indigo-400",
      bg: "bg-indigo-400/10",
      label: "POLL",
    },
    goal: {
      icon: Zap,
      color: "text-amber-300",
      bg: "bg-amber-300/10",
      label: "GOAL",
    },
    room_user: {
      icon: Eye,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      label: "ROOM USER",
    },
    link_mic_battle: {
      icon: Zap,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
      label: "PK BATTLE",
    },
    live_intro: {
      icon: Radio,
      color: "text-cyan-300",
      bg: "bg-cyan-300/10",
      label: "LIVE INTRO",
    },
    stream_end: {
      icon: Power,
      color: "text-red-400",
      bg: "bg-red-400/10",
      label: "STREAM END",
    },
  };

  return (
    styles[normalizedType] || {
      icon: Zap,
      color: "text-slate-400",
      bg: "bg-slate-400/10",
      label: normalizedType.replace(/_/g, " ").toUpperCase(),
    }
  );
}

// ========================================
// COMPONENTS
// ========================================

function StatCard({ label, value, icon: Icon, color, description }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-4 transition hover:border-white/10 sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[1.5px] text-slate-500">
          {label}
        </span>

        <div className={`rounded-xl bg-white/[0.04] p-2 ${color}`}>
          <Icon size={19} />
        </div>
      </div>

      <div className="mt-4 text-2xl font-bold text-white sm:text-3xl">
        {formatNumber(value)}
      </div>

      <p className="mt-1 text-[11px] text-slate-500">{description}</p>
    </div>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold text-white">{title}</h3>

        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>

      {right}
    </div>
  );
}

// ========================================
// MAIN APP
// ========================================

export default function App() {
  const {
    status,
    events = [],
    room,
    error,
    connect,
    disconnect,
  } = useLiveSocket();

  const [input, setInput] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rawEvent, setRawEvent] = useState(null);
  const [clearBefore, setClearBefore] = useState(0);

  const username = getUsername(input);

  const connected = status?.status === "connected";
  const connecting =
    status?.status === "connecting" || status?.status === "reconnecting";

  // ========================================
  // EVENTS
  // ========================================

  const visibleEvents = useMemo(() => {
    return events.filter((event) => {
      const timestamp = Number(event.timestamp || 0);
      return timestamp > clearBefore;
    });
  }, [events, clearBefore]);

  // ========================================
  // STATISTICS
  // ========================================

  const stats = useMemo(() => {
    const count = (type) =>
      visibleEvents.filter(
        (event) => normalizeEventType(event.type) === normalizeEventType(type),
      ).length;

    return [
      {
        label: "VIEWERS",
        value: room?.user_count ?? room?.userCount ?? 0,
        icon: Eye,
        color: "text-violet-400",
        description: "Current audience",
      },
      {
        label: "LIKES",
        value: count("like"),
        icon: Heart,
        color: "text-pink-400",
        description: "Like events received",
      },
      {
        label: "COMMENTS",
        value: count("chat"),
        icon: MessageCircle,
        color: "text-sky-400",
        description: "Comments received",
      },
      {
        label: "GIFTS",
        value: count("gift"),
        icon: Gift,
        color: "text-amber-400",
        description: "Gift events received",
      },
    ];
  }, [visibleEvents, room]);

  // ========================================
  // FILTER EVENTS
  // ========================================

  const filteredEvents = useMemo(() => {
    return visibleEvents.filter((event) => {
      const matchType =
        filter === "all" ||
        normalizeEventType(event.type) === normalizeEventType(filter);

      const data = event.data || {};

      const content = [
        event.type,
        getEventUser(data),
        getEventDescription(event),
        data.comment,
        data.giftName,
        data.action,
        data.question,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchType && content.includes(search.toLowerCase());
    });
  }, [visibleEvents, filter, search]);

  // ========================================
  // CONNECT
  // ========================================

  async function handleConnect(e) {
    e.preventDefault();

    if (!username || loading || connected || connecting) return;

    setLoading(true);

    try {
      await connect(username);
    } catch (err) {
      console.error("Connection failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // DISCONNECT
  // ========================================

  async function handleDisconnect() {
    if (loading) return;

    setLoading(true);

    try {
      await disconnect();
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setLoading(false);
    }
  }

  // ========================================
  // CLEAR EVENTS
  // ========================================

  function clearEvents() {
    setClearBefore(Date.now());
    setRawEvent(null);
  }

  // ========================================
  // COPY JSON
  // ========================================

  async function copyRawEvent(event) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  // ========================================
  // UI STARTS IN PART 2
  // ========================================

  return (
    <div className="min-h-screen bg-[#090d18] text-slate-100">
      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0d1220]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
            >
              <Menu size={21} />
            </button>

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-600 shadow-lg shadow-purple-900/30">
              <Radio size={22} />
            </div>

            <div>
              <h1 className="text-lg font-black tracking-wide text-white">
                LIVE<span className="text-pink-400">PULSE</span>
              </h1>
              <p className="text-[9px] font-semibold tracking-[2px] text-slate-500">
                TIKTOK LIVE MONITOR
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-2 sm:flex">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected
                    ? "bg-emerald-400"
                    : connecting
                      ? "animate-pulse bg-amber-400"
                      : "bg-slate-500"
                }`}
              />

              <span className="text-[10px] font-bold tracking-wider text-slate-400">
                {connected
                  ? "LIVE CONNECTED"
                  : status?.status === "reconnecting"
                    ? "RECONNECTING"
                    : connecting
                      ? "CONNECTING"
                      : "DISCONNECTED"}
              </span>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-400">
              <Signal size={17} />
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT */}

      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[230px_minmax(0,1fr)]">
        {/* SIDEBAR */}

        <aside
          className={`fixed bottom-0 left-0 top-[68px] z-50 w-[270px] border-r border-white/[0.06] bg-[#0d1220] p-5 transition-transform duration-300 lg:sticky lg:top-[68px] lg:h-[calc(100vh-68px)] lg:w-auto lg:translate-x-0 lg:bg-transparent ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-7 flex items-center justify-between lg:hidden">
            <span className="text-sm font-semibold text-white">Navigation</span>

            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5"
            >
              <X size={19} />
            </button>
          </div>

          <p className="mb-3 px-3 text-[10px] font-bold tracking-[2px] text-slate-600">
            WORKSPACE
          </p>

          <nav className="space-y-1">
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex w-full items-center gap-3 rounded-xl border border-violet-500/10 bg-violet-500/10 px-3 py-3 text-sm font-semibold text-violet-300"
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              onClick={() => {
                setFilter("all");
                setSidebarOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Radio size={18} />
              Live Monitor
            </button>

            <button
              onClick={() => {
                setFilter("gift");
                setSidebarOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Gift size={18} />
              Gift Tracker
            </button>

            <button
              onClick={() => {
                setFilter("member");
                setSidebarOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              <Users size={18} />
              Audience
            </button>
          </nav>

          <div className="mt-10 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-[#171d31] to-[#111827] p-4">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-400" />
              <span className="text-xs font-bold text-white">Quick tip</span>
            </div>

            <p className="mt-3 text-xs leading-6 text-slate-500">
              Paste any TikTok profile URL or username to start monitoring a
              LIVE session.
            </p>
          </div>

          <div className="absolute bottom-6 left-5 right-5 hidden items-center gap-2 border-t border-white/[0.06] pt-5 lg:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-violet-600">
              <Radio size={16} />
            </div>

            <div>
              <p className="text-xs font-semibold text-white">LIVEPULSE</p>
              <p className="text-[10px] text-slate-600">Version 1.0.0</p>
            </div>
          </div>
        </aside>

        {/* MOBILE OVERLAY */}

        {sidebarOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          />
        )}

        {/* MAIN */}

        <main className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
          {/* PAGE TITLE */}

          <section className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Live Dashboard
                </h2>

                <span className="rounded-md border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[9px] font-bold text-violet-300">
                  BETA
                </span>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Monitor your TikTok LIVE events in real time.
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 sm:flex">
              <Activity size={15} className="text-emerald-400" />
              <span className="text-xs text-slate-400">System Monitor</span>
            </div>
          </section>

          {/* CONNECT CARD */}

          <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-[#171d31] to-[#111626]">
            <div className="border-b border-white/[0.05] px-4 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-pink-500/10 p-2">
                  <Radio size={17} className="text-pink-400" />
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">
                    Connect to TikTok LIVE
                  </h3>

                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Enter a TikTok profile or share URL.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <form
                onSubmit={handleConnect}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/[0.08] bg-[#090d18] px-4 focus-within:border-violet-500/50">
                  <Search size={18} className="shrink-0 text-slate-500" />

                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={connected || connecting || loading}
                    placeholder="Paste TikTok link or @username..."
                    className="w-full min-w-0 bg-transparent py-4 text-sm text-white outline-none placeholder:text-slate-600 disabled:opacity-50"
                  />

                  {input && (
                    <button
                      type="button"
                      onClick={() => setInput("")}
                      disabled={connected || loading}
                      className="shrink-0 text-slate-500 hover:text-white"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {connected || connecting ? (
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Power size={17} />
                    {status?.status === "reconnecting"
                      ? "Stop reconnecting"
                      : "Disconnect"}
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!username || loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-purple-900/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <RefreshCw size={17} className="animate-spin" />
                    ) : (
                      <Wifi size={17} />
                    )}

                    {loading ? "Connecting..." : "Connect LIVE"}
                  </button>
                )}
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {username ? (
                    <>
                      Detected username:{" "}
                      <span className="font-semibold text-violet-300">
                        @{username}
                      </span>
                    </>
                  ) : (
                    "Supported: username, @username or TikTok URL"
                  )}
                </p>

                {connected && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Connected to @{status?.username || username}
                  </span>
                )}

                {status?.status === "reconnecting" && (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    Reconnecting to @{status?.username || username}
                  </span>
                )}
              </div>

              {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}
            </div>
          </section>

          {/* STATISTICS */}

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </section>

          {/* EVENT FEED */}

          <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]">
              <div className="border-b border-white/[0.06] p-4 sm:p-5">
                <SectionTitle
                  title="Live Event Stream"
                  subtitle={`${filteredEvents.length.toLocaleString()} events displayed`}
                  right={
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/10 bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      REALTIME
                    </span>
                  }
                />

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/[0.06] bg-[#090d18] px-3">
                    <Search size={15} className="shrink-0 text-slate-500" />

                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search users, comments, events..."
                      className="w-full min-w-0 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-600"
                    />

                    {search && (
                      <button onClick={() => setSearch("")}>
                        <X size={14} className="text-slate-500" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-[#090d18] px-3 py-2.5 text-xs text-slate-300 outline-none sm:flex-none"
                    >
                      <option value="all">All events</option>
                      <option value="chat">Chat</option>
                      <option value="gift">Gift</option>
                      <option value="like">Like</option>
                      <option value="member">Member</option>
                      <option value="follow">Follow</option>
                      <option value="share">Share</option>
                      <option value="subscribe">Subscribe</option>
                      <option value="social">Social</option>
                      <option value="emote">Emote</option>
                      <option value="question">Question</option>
                      <option value="envelope">Envelope</option>
                      <option value="poll">Poll</option>
                      <option value="goal">Goal</option>
                      <option value="roomUser">Room User</option>
                      <option value="linkMicBattle">PK Battle</option>
                    </select>

                    <button
                      onClick={clearEvents}
                      title="Clear displayed events"
                      className="flex items-center justify-center rounded-lg border border-white/[0.06] bg-[#090d18] px-3 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* EVENT LIST */}

              <div className="max-h-[650px] min-h-[350px] overflow-y-auto">
                {filteredEvents.length === 0 ? (
                  <div className="flex min-h-[350px] flex-col items-center justify-center px-5 text-center">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5">
                      <Activity size={30} className="text-slate-500" />
                    </div>

                    <h4 className="mt-4 text-sm font-bold text-slate-300">
                      No events yet
                    </h4>

                    <p className="mt-2 max-w-[260px] text-xs leading-5 text-slate-500">
                      Connect to a TikTok LIVE to start receiving realtime
                      events.
                    </p>
                  </div>
                ) : (
                  filteredEvents.map((event, index) => {
                    const style = getEventStyle(event.type);
                    const Icon = style.icon;

                    return (
                      <div
                        key={event.id || `${event.timestamp}-${index}`}
                        className="group flex items-start gap-3 border-b border-white/[0.035] px-4 py-4 transition hover:bg-white/[0.025] sm:px-5"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.bg} ${style.color}`}
                        >
                          <Icon size={17} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="max-w-[180px] truncate text-sm font-bold text-slate-200">
                              {getEventUser(event.data)}
                            </span>

                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${style.bg} ${style.color}`}
                            >
                              {style.label}
                            </span>
                          </div>

                          <p className="mt-1 break-words text-sm leading-5 text-slate-400">
                            {getEventDescription(event)}
                          </p>

                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                            <Clock size={11} />
                            {formatTime(event.timestamp)}
                          </div>
                        </div>

                        <button
                          onClick={() => setRawEvent(event)}
                          title="View raw event"
                          className="shrink-0 rounded-lg p-2 text-slate-600 hover:bg-violet-500/10 hover:text-violet-300 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Code2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-3 sm:px-5">
                <span className="text-[10px] text-slate-600">
                  Showing latest {filteredEvents.length} events
                </span>

                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <Signal size={12} />
                  Socket.IO
                </span>
              </div>
            </div>

            {/* RIGHT PANEL */}

            <div className="space-y-5">
              {/* CONNECTION INFO */}

              <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-5">
                <SectionTitle
                  title="Connection Info"
                  subtitle="Current LIVE session"
                />

                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Status</span>

                    <span
                      className={`flex items-center gap-1.5 text-xs font-semibold ${
                        connected
                          ? "text-emerald-400"
                          : connecting
                            ? "text-amber-400"
                            : "text-slate-500"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          connected
                            ? "bg-emerald-400"
                            : connecting
                              ? "bg-amber-400"
                              : "bg-slate-500"
                        }`}
                      />

                      {connected
                        ? "Connected"
                        : connecting
                          ? "Connecting"
                          : "Offline"}
                    </span>
                  </div>

                  <div className="h-px bg-white/[0.05]" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Username</span>

                    <span className="max-w-[150px] truncate text-xs font-semibold text-slate-300">
                      {status?.username
                        ? `@${status.username}`
                        : username
                          ? `@${username}`
                          : "--"}
                    </span>
                  </div>

                  <div className="h-px bg-white/[0.05]" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Room ID</span>

                    <span className="max-w-[150px] truncate font-mono text-[10px] text-slate-400">
                      {room?.room_id || room?.roomId || "--"}
                    </span>
                  </div>

                  <div className="h-px bg-white/[0.05]" />

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Events received
                    </span>

                    <span className="text-xs font-bold tabular-nums text-white">
                      {formatNumber(visibleEvents.length)}
                    </span>
                  </div>
                </div>
              </div>

              {/* EVENT DISTRIBUTION */}

              <div className="rounded-2xl border border-white/[0.06] bg-[#111827] p-5">
                <SectionTitle
                  title="Event Distribution"
                  subtitle="Events by category"
                />

                <div className="mt-5 space-y-4">
                  {[
                    {
                      type: "chat",
                      label: "Comments",
                      color: "bg-sky-400",
                    },
                    {
                      type: "gift",
                      label: "Gifts",
                      color: "bg-amber-400",
                    },
                    {
                      type: "like",
                      label: "Likes",
                      color: "bg-pink-400",
                    },
                    {
                      type: "member",
                      label: "Members",
                      color: "bg-violet-400",
                    },
                    {
                      type: "follow",
                      label: "Follows",
                      color: "bg-emerald-400",
                    },
                    {
                      type: "share",
                      label: "Shares",
                      color: "bg-cyan-400",
                    },
                  ].map((item) => {
                    const count = visibleEvents.filter(
                      (event) =>
                        normalizeEventType(event.type) ===
                        normalizeEventType(item.type),
                    ).length;

                    const total = Math.max(visibleEvents.length, 1);
                    const percentage = Math.round((count / total) * 100);

                    return (
                      <div key={item.type}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs text-slate-400">
                            {item.label}
                          </span>

                          <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                            {formatNumber(count)} ({percentage}%)
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QUICK SUMMARY */}

              <div className="rounded-2xl border border-violet-500/10 bg-gradient-to-br from-violet-500/10 to-pink-500/5 p-5">
                <div className="flex items-center gap-2">
                  <Activity size={17} className="text-violet-400" />

                  <h3 className="text-sm font-bold text-white">
                    Activity Summary
                  </h3>
                </div>

                <p className="mt-3 text-xs leading-6 text-slate-400">
                  {connected
                    ? `Currently monitoring @${status?.username || username}. ${visibleEvents.length} events have been received in this session.`
                    : "Connect to a TikTok LIVE session to start collecting audience activity and event statistics."}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">
                    Total activity
                  </span>

                  <span className="text-lg font-black text-white">
                    {formatNumber(visibleEvents.length)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* RAW EVENT MODAL */}

          {rawEvent && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setRawEvent(null)}
            >
              <div
                className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] p-4 sm:p-5">
                  <div className="flex items-center gap-2">
                    <Code2 size={18} className="text-violet-400" />

                    <div>
                      <h3 className="text-sm font-bold text-white">
                        Raw Event Data
                      </h3>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {rawEvent.type?.toUpperCase() || "UNKNOWN EVENT"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setRawEvent(null)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[55vh] overflow-auto p-4 sm:p-5">
                  <pre className="overflow-x-auto rounded-xl border border-white/[0.05] bg-[#090d18] p-4 font-mono text-[11px] leading-6 text-emerald-300">
                    {JSON.stringify(rawEvent, null, 2)}
                  </pre>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] p-4">
                  <button
                    onClick={() => copyRawEvent(rawEvent)}
                    className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
                  >
                    <Copy size={14} />
                    Copy JSON
                  </button>

                  <button
                    onClick={() => setRawEvent(null)}
                    className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-violet-500"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER */}

          <footer className="flex flex-col gap-3 border-t border-white/[0.06] py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
              <span className="font-bold tracking-wider text-slate-500">
                LIVEPULSE
              </span>

              <span>•</span>

              <span>TikTok LIVE Monitor</span>

              <span>•</span>

              <span>Version 1.0.0</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-600">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-emerald-400" : "bg-slate-500"
                }`}
              />

              <span>
                {connected ? "Monitoring active" : "Waiting for connection"}
              </span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

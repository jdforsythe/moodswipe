import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  History,
  Info,
  Settings2,
  Shuffle,
  WifiOff,
  Download,
  LoaderCircle,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  AESTHETICS,
  MOODS,
  TOPICS,
  moodLabels,
  type Action,
  type Parameters,
  type ReadyCard,
} from "../shared/types";
import { CardQueue, ready } from "./lib/queue";
import {
  addRejected,
  clearRejected,
  getRejected,
  readParams,
  writeParams,
} from "./lib/storage";
import { exportCard } from "./lib/export";
import { gestureAction, lockAxis, type Axis } from "./lib/gestures";
import { Modal } from "./components/Modal";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function App() {
  const [params, setParams] = useState(readParams);
  const [queue] = useState(() => new CardQueue(params));
  const [, redraw] = useState(0);
  const [view, setView] = useState<"main" | "rejected">("main");
  const [rejected, setRejected] = useState<ReadyCard[]>([]);
  const [rejectedIndex, setRejectedIndex] = useState(0);
  const [modal, setModal] = useState<
    "settings" | "info" | "privacy" | "clear" | "export" | null
  >(null);
  const [draft, setDraft] = useState(params);
  const [exportIntent, setExportIntent] = useState<"save" | "share">("save");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const pointer = useRef<{
    id: number;
    x: number;
    y: number;
    time: number;
    last: number;
    lastTime: number;
    velocity: number;
    axis: Axis;
  } | null>(null);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const card = view === "main" ? queue.cards[0] : rejected[rejectedIndex];
  useEffect(() => {
    queue.onChange = () => redraw((n) => n + 1);
    void queue.start();
    return () => queue.stop();
  }, [queue]);
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) {
        queue.remote.nextAttempt = 0;
        queue.remote.checked = false;
        void queue.remote.replenish(queue.params);
      }
    };
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const visibility = () => {
      if (document.hidden) queue.remote.suspend();
      else void queue.remote.replenish(queue.params);
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", prompt);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", prompt);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(
    () => () => {
      rejected.forEach((c) => URL.revokeObjectURL(c.url));
    },
    [rejected],
  );
  const applyParams = (p: Parameters) => {
    setParams(p);
    queue.setParams(p);
    if (!writeParams(p))
      setNotice("Settings apply now, but this browser could not store them.");
  };
  const advance = (exported = false) => {
    if (view === "main") {
      if (!queue.advance(exported))
        setNotice("Preparing the next photo. Try again in a moment.");
    } else setRejectedIndex((i) => (i + 1) % Math.max(1, rejected.length));
  };
  async function act(action: Action) {
    if (lock.current || !card || modal) return;
    lock.current = true;
    setBusy(true);
    setDrag({ x: 0, y: 0, active: false });
    try {
      if (action === "dismiss") {
        if (view === "main") await addRejected(card);
        advance();
      } else {
        const result = await exportCard(card, action);
        if (result === "open") {
          setExportIntent(action);
          setModal("export");
          return;
        }
        if (result === "canceled") {
          setNotice("Sharing canceled. Your meme is still here.");
          return;
        }
        setNotice(
          result === "downloaded"
            ? "Download started. Check your browser’s Downloads."
            : action === "save"
              ? "Export completed. The destination is chosen in the share sheet."
              : "Shared. This one stays here.",
        );
        if (action === "save") advance(true);
      }
    } catch {
      setNotice(
        action === "dismiss"
          ? "Could not store this meme. Free some device storage and try Dismiss again."
          : `${action === "save" ? "Save" : "Share"} did not complete. Your meme is still here; try again.`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function openRejected() {
    try {
      const cards = (await getRejected()).map(ready);
      setRejected(cards);
      setRejectedIndex((i) => Math.min(i, Math.max(0, cards.length - 1)));
      setView("rejected");
    } catch {
      setNotice("Local history is unavailable in this browser.");
    }
  }
  function finishPointer(e: React.PointerEvent<HTMLElement>, cancel = false) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = null;
    const dx = e.clientX - p.x,
      dy = e.clientY - p.y;
    const velocity = performance.now() - p.lastTime < 100 ? p.velocity : 0;
    const action = cancel
      ? null
      : gestureAction(dx, dy, velocity, p.axis, e.currentTarget.clientWidth);
    setDrag({ x: 0, y: 0, active: false });
    if (action) void act(action);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="MoodSwipe home">
          mood<span>swipe</span>
          <i />
        </a>
        <div className="top-actions">
          <button
            className={`icon-button ${view === "rejected" ? "selected" : ""}`}
            aria-label="Rejected feed"
            onClick={() =>
              view === "rejected" ? setView("main") : void openRejected()
            }
          >
            <History size={21} />
          </button>
          <button
            className="icon-button"
            aria-label="Settings"
            onClick={() => {
              setDraft(params);
              setModal("settings");
            }}
          >
            <Settings2 size={21} />
          </button>
        </div>
      </header>
      <main>
        <div className="feed-heading">
          <div>
            {view === "rejected" ? (
              <>
                <button className="back-button" onClick={() => setView("main")}>
                  <ArrowLeft size={16} /> Your feed
                </button>
                <h1>Second thoughts.</h1>
              </>
            ) : (
              <>
                <p className="eyebrow">A LITTLE PERSPECTIVE</p>
                <h1>Find your kind of funny.</h1>
              </>
            )}
          </div>
          <button
            className={`random-toggle ${params.random ? "selected" : ""}`}
            aria-pressed={params.random}
            aria-label="Random Mode"
            onClick={() => applyParams({ ...params, random: !params.random })}
          >
            <Shuffle size={16} />
            <span>Random</span>
            {params.random && <Check size={13} />}
          </button>
        </div>
        <div className="viewer-wrap">
          {card ? (
            <article
              className={`viewer ${drag.active ? "dragging" : ""}`}
              data-testid="viewer"
              data-card-id={card.id}
              data-caption-id={card.caption.id}
              data-source={card.caption.source}
              data-photo-id={card.photo.id}
              data-type-style={card.layout.style}
              data-font={card.layout.font}
              data-region={card.layout.region}
              data-alignment={card.layout.alignment}
              data-scrim={card.layout.scrim}
              data-font-size={card.layout.fontSize}
              tabIndex={0}
              aria-label={`${view === "rejected" ? "Rejected meme" : "Meme"}: ${card.caption.text}`}
              aria-describedby="gesture-help"
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                const action =
                  e.key === "ArrowLeft"
                    ? "dismiss"
                    : e.key === "ArrowRight"
                      ? "save"
                      : e.key === "ArrowUp"
                        ? "share"
                        : null;
                if (action) {
                  e.preventDefault();
                  void act(action);
                }
              }}
              onPointerDown={(e) => {
                if (
                  (e.target as HTMLElement).closest("button,a") ||
                  busy ||
                  modal ||
                  e.button !== 0 ||
                  !e.isPrimary
                )
                  return;
                e.currentTarget.setPointerCapture(e.pointerId);
                pointer.current = {
                  id: e.pointerId,
                  x: e.clientX,
                  y: e.clientY,
                  time: performance.now(),
                  last: 0,
                  lastTime: performance.now(),
                  velocity: 0,
                  axis: null,
                };
              }}
              onPointerMove={(e) => {
                const p = pointer.current;
                if (!p || p.id !== e.pointerId) return;
                const dx = e.clientX - p.x,
                  dy = e.clientY - p.y;
                p.axis ??= lockAxis(dx, dy);
                const n = performance.now(),
                  value = p.axis === "x" ? dx : dy;
                p.velocity = (value - p.last) / Math.max(1, n - p.lastTime);
                p.last = value;
                p.lastTime = n;
                if (p.axis)
                  setDrag({
                    x: p.axis === "x" ? dx : 0,
                    y: p.axis === "y" ? Math.min(40, dy) : 0,
                    active: true,
                  });
              }}
              onPointerUp={(e) => finishPointer(e)}
              onPointerCancel={(e) => finishPointer(e, true)}
              onLostPointerCapture={() => {
                pointer.current = null;
                setDrag({ x: 0, y: 0, active: false });
              }}
              style={{
                transform: `translate(${drag.x * 0.65}px,${drag.y * 0.65}px) rotate(${drag.x * 0.025}deg)`,
              }}
            >
              <img
                className="composition"
                src={card.url}
                alt={card.caption.text}
                draggable={false}
              />
              <div className="card-top">
                <span className="mood-label">
                  {moodLabels[card.params.mood]}
                </span>
                <button
                  className="photo-info"
                  aria-label="Photo and caption details"
                  onClick={() => setModal("info")}
                >
                  <Info size={19} />
                </button>
              </div>
              {drag.active &&
                Math.max(Math.abs(drag.x), Math.abs(drag.y)) > 25 && (
                  <span className="drag-hint">
                    {drag.x < -25
                      ? "Dismiss"
                      : drag.x > 25
                        ? "Save"
                        : drag.y < -25
                          ? "Share"
                          : ""}
                  </span>
                )}
              <div className="action-row">
                <button disabled={busy} onClick={() => void act("dismiss")}>
                  Dismiss
                </button>
                <button disabled={busy} onClick={() => void act("share")}>
                  Share
                </button>
                <button
                  className="save-button"
                  disabled={busy}
                  onClick={() => void act("save")}
                >
                  Save
                </button>
              </div>
            </article>
          ) : (
            <div
              className="empty-state"
              aria-busy={view === "main" && !queue.error}
              data-testid={view === "main" ? "first-card-loading" : undefined}
            >
              {view === "rejected" ? (
                <>
                  <History size={36} />
                  <h2>Nothing rejected. Yet.</h2>
                  <p>
                    Memes you dismiss will stay here for up to 30 days, just on
                    this device.
                  </p>
                  <button
                    className="primary-button"
                    onClick={() => setView("main")}
                  >
                    Back to your feed
                  </button>
                </>
              ) : (
                <>
                  {!queue.error && (
                    <LoaderCircle
                      className="loading-spinner"
                      size={40}
                      aria-hidden="true"
                    />
                  )}
                  <h2>
                    {queue.error
                      ? "A little pause."
                      : queue.remote.status === "generating"
                        ? "Creating your first meme…"
                        : "Finding a little perspective…"}
                  </h2>
                  <p aria-live="polite">
                    {queue.error ||
                      (queue.remote.status === "generating"
                        ? "Writing something fresh for you. This can take around 30 seconds."
                        : queue.remote.status === "ready"
                          ? "Putting the words and photo together."
                          : "Checking for fresh captions.")}
                  </p>
                  {queue.error && (
                    <button
                      className="primary-button"
                      onClick={() => void queue.fill()}
                    >
                      Try again
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {card?.photo.source === "Pexels" && (
          <div className="photo-credit">
            <a href="https://www.pexels.com" target="_blank" rel="noreferrer">
              Photos provided by Pexels
            </a>
            <a href={card.photo.sourceUrl} target="_blank" rel="noreferrer">
              {card.photo.creator}
            </a>
          </div>
        )}
        <div className="feed-footer">
          <span className="feed-status">
            {!online ? (
              <>
                <WifiOff size={13} /> Offline collection
              </>
            ) : card?.caption.source === "local" ? (
              "Curated collection"
            ) : card?.caption.source === "llm" ? (
              "Freshly imagined"
            ) : card?.caption.source === "salvage" ? (
              "A fresh perspective"
            ) : card?.caption.source === "remix" ? (
              "Reimagined"
            ) : (
              ""
            )}
          </span>
          {view === "rejected" ? (
            <button className="text-button" onClick={() => setModal("clear")}>
              Clear Rejected {rejected.length > 0 && `(${rejected.length})`}
            </button>
          ) : (
            <button className="text-button" onClick={() => setModal("privacy")}>
              About & privacy <ArrowUpRight size={13} />
            </button>
          )}
        </div>
        {view === "main" && online && card && (
          <div className="generation-status" data-testid="generation-status">
            <span aria-live="polite">
              {
                {
                  checking: "Checking for fresh captions…",
                  disabled: "Fresh captions are not enabled.",
                  generating: "Creating fresh captions… keep swiping.",
                  ready: "Fresh captions are ready.",
                  waiting: "More captions will be requested shortly.",
                  unavailable:
                    "Fresh captions are temporarily unavailable. The curated collection is ready.",
                  limited:
                    "The AI limit has been reached. The curated collection is ready.",
                }[queue.remote.status]
              }
            </span>
            {!queue.remote.pending &&
              ["disabled", "waiting", "unavailable", "limited"].includes(
                queue.remote.status,
              ) && (
                <button
                  className="text-button"
                  onClick={() => void queue.remote.retry(queue.params)}
                >
                  Try fresh captions
                </button>
              )}
          </div>
        )}
        <p id="gesture-help" className="sr-only">
          Swipe or use arrow keys: left to dismiss, right to save, up to share.
          You can also use the three buttons on the image.
        </p>
      </main>
      <footer className="desktop-footer">
        <span>Good moods. Odd thoughts. Yours to keep.</span>
        <span>
          {offlineReady
            ? "Ready to go offline"
            : "No account. Just a little perspective."}
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {needRefresh && (
        <button
          className="update-banner"
          onClick={() => void updateServiceWorker(true)}
        >
          A new version is ready. Update
        </button>
      )}
      {modal === "settings" && (
        <Modal title="Make it your mood." onClose={() => setModal(null)}>
          <p className="muted">
            A little more you. Changes apply to the next meme.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              applyParams(draft);
              setModal(null);
            }}
          >
            <fieldset>
              <legend>Mood</legend>
              <div className="mood-grid">
                {MOODS.map((m) => (
                  <button
                    type="button"
                    key={m}
                    aria-pressed={draft.mood === m}
                    className={draft.mood === m ? "selected" : ""}
                    onClick={() => setDraft({ ...draft, mood: m })}
                  >
                    {moodLabels[m]}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="field">
              Topic
              <select
                value={draft.topic}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    topic: e.target.value as Parameters["topic"],
                  })
                }
              >
                {TOPICS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Intensity{" "}
              <span className="range-value">{draft.intensity} / 5</span>
              <input
                type="range"
                min="1"
                max="5"
                value={draft.intensity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    intensity: Number(
                      e.target.value,
                    ) as Parameters["intensity"],
                  })
                }
              />
              <span className="range-ends">
                <span>A gentle nudge</span>
                <span>All the way</span>
              </span>
            </label>
            <label className="field">
              Photo aesthetic
              <select
                value={draft.aesthetic}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    aesthetic: e.target.value as Parameters["aesthetic"],
                  })
                }
              >
                {AESTHETICS.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={draft.random}
                onChange={(e) =>
                  setDraft({ ...draft, random: e.target.checked })
                }
              />
              Random Mode <span>Fresh settings for every new meme.</span>
            </label>
            <p className="small muted">
              The offline collection matches your mood and favors your topic and
              intensity. Its selection is finite.
            </p>
            <button className="primary-button wide" type="submit">
              Set the mood
            </button>
          </form>
        </Modal>
      )}
      {modal === "info" && card && (
        <Modal title="Behind this one." onClose={() => setModal(null)}>
          <p>{card.caption.text}</p>
          <dl>
            <dt>Caption</dt>
            <dd>
              {card.caption.source === "local"
                ? "Handwritten offline collection"
                : card.caption.source === "llm"
                  ? "AI-generated"
                  : card.caption.source === "salvage"
                    ? "AI-generated · recovered after cooldown"
                    : "AI-generated · remixed composition"}
            </dd>
            <dt>Photo</dt>
            <dd>
              <a href={card.photo.sourceUrl} target="_blank" rel="noreferrer">
                {card.photo.creator || card.photo.source} ↗
              </a>
            </dd>
            <dt>License</dt>
            <dd>
              <a href={card.photo.licenseUrl} target="_blank" rel="noreferrer">
                {card.photo.license}
              </a>
            </dd>
            <dt>Your mix</dt>
            <dd>
              {moodLabels[card.params.mood]} · {card.params.topic} ·{" "}
              {card.params.intensity}/5
            </dd>
            <dt>Composition</dt>
            <dd>
              {card.layout.width} × {card.layout.height} PNG ·{" "}
              {card.layout.font}
            </dd>
          </dl>
        </Modal>
      )}
      {modal === "privacy" && (
        <Modal title="A little perspective." onClose={() => setModal(null)}>
          <p>
            MoodSwipe pairs original captions with real photography. Swipe left
            to dismiss, right to save, or up to share. The buttons do the same.
          </p>
          <h3>Just on this device</h3>
          <p>
            Settings, recent caption fingerprints, and up to 100 dismissed memes
            stay in your browser. Rejected history expires after 30 days and is
            limited to 100 MB. There is no account, saved gallery, tracking, or
            cloud sync.
          </p>
          <h3>Made to leave the screen</h3>
          <p>
            Save starts a download on Android. On iPhone, choose a destination
            in the share sheet or touch and hold the exported image to save. A
            download is not a verified camera-roll save. Share destinations
            depend on your installed apps.
          </p>
          <h3>When you are online</h3>
          <p>
            If enabled by the operator, the server requests generic caption
            batches from an AI provider and photos from a stock provider. Only
            the current filter choices are sent to request a batch. Your
            Rejected feed, exports, and preference history never leave this
            device. The server briefly uses a daily IP-derived hash to limit
            abuse; hosting providers process normal connection data. When
            dynamic photos are enabled, your browser also connects to Pexels to
            load the photograph.
          </p>
          <p>
            <strong>Built with Llama</strong> · Optional AI captions run on
            Cloudflare Workers AI.
          </p>
          <h3>Take it with you</h3>
          {install ? (
            <button
              className="primary-button"
              onClick={async () => {
                await install.prompt();
                await install.userChoice;
                setInstall(null);
              }}
            >
              <Download size={17} /> Install MoodSwipe
            </button>
          ) : (
            <p>
              Android: use your browser menu → Install app or Add to Home
              screen. iPhone: Safari → Share → Add to Home Screen. Open once
              online and wait for “Ready to go offline.”
            </p>
          )}
          <p className="small muted">
            {offlineReady
              ? "The offline pack is ready."
              : "The offline pack is still preparing, or service workers are unavailable."}
          </p>
        </Modal>
      )}
      {modal === "clear" && (
        <Modal title="Clear Rejected?" onClose={() => setModal(null)}>
          <p>
            This removes all rejected memes from this browser. This cannot be
            undone.
          </p>
          <div className="dialog-actions">
            <button onClick={() => setModal(null)}>Keep them</button>
            <button
              className="primary-button"
              onClick={async () => {
                try {
                  await clearRejected();
                  setRejected([]);
                  setRejectedIndex(0);
                  setModal(null);
                  setNotice("Rejected history cleared.");
                } catch {
                  setNotice("Could not clear local history. Please try again.");
                }
              }}
            >
              Clear Rejected
            </button>
          </div>
        </Modal>
      )}
      {modal === "export" && card && (
        <Modal title="Save your image." onClose={() => setModal(null)}>
          <p>
            Touch and hold the image, then choose Save Image or Download Image.
            Your meme stays in the feed until you confirm.
          </p>
          <img
            className="export-preview"
            src={card.url}
            alt={card.caption.text}
          />
          <a
            className="primary-button wide"
            href={card.url}
            target="_blank"
            rel="noreferrer"
          >
            Open full-size image
          </a>
          <button
            className="text-button wide"
            onClick={() => {
              setModal(null);
              if (exportIntent === "save") advance(true);
            }}
          >
            {exportIntent === "save"
              ? "I saved it — next meme"
              : "Back to this meme"}
          </button>
        </Modal>
      )}
    </div>
  );
}

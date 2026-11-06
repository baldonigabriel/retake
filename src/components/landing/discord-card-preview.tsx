import { Fragment } from "react";

import { formatRelativeTime } from "@/lib/format";
import type { WebhookPayload } from "@/lib/discord/card";

/** Renders the little Discord markdown our cards use: **bold**, \-escapes and <t:unix:R>. */
function Markdown({ text, now }: { text: string; now: Date }) {
  const withTimes = text.replace(/<t:(\d+):R>/g, (_, unix: string) => formatRelativeTime(new Date(Number(unix) * 1000), now));
  const parts = withTimes.split(/(\*\*(?:\\.|[^*])+\*\*)/g);
  const unescape = (s: string) => s.replace(/\\(.)/g, "$1");
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-fg">
            {unescape(part.slice(2, -2))}
          </strong>
        ) : (
          <Fragment key={i}>{unescape(part)}</Fragment>
        ),
      )}
    </>
  );
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/**
 * How a match card looks in the channel. Drawn from the real webhook payload
 * (src/lib/discord/card.ts), so the preview can't drift from what's posted.
 * Discord's own chrome is approximated with our surfaces, not copied.
 */
export function DiscordCardPreview({ payload, now, channel }: { payload: WebhookPayload; now: Date; channel: string }) {
  const embed = payload.embeds[0]!;
  return (
    <div className="flex flex-col gap-3 rounded-card-lg bg-surface-1 p-4 shadow-key sm:p-5">
      <p className="flex items-center gap-1.5 border-b border-line pb-3 text-body-sm text-fg-secondary">
        <span aria-hidden="true" className="font-mono text-fg-muted">
          #
        </span>
        {channel}
      </p>
      <div className="flex gap-3">
        <span aria-hidden="true" className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary">
          <svg viewBox="0 0 20 20" className="size-4">
            <path d="M2 2h11l5 5v11H2z" fill="var(--color-on-accent)" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-fg">{payload.username}</span>
            <span className="rounded-chip bg-surface-3 px-1 text-[10px] leading-4 font-semibold tracking-wide text-fg-secondary uppercase">
              app
            </span>
            <span className="text-label font-normal text-fg-muted">hoje às 22:22</span>
          </p>
          <article
            className="flex min-w-0 gap-3 rounded-control bg-surface-2 py-3 pr-3 pl-4"
            style={{ boxShadow: `inset 4px 0 0 ${hex(embed.color)}` }}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <h3 className="text-body-sm font-semibold text-fg">{embed.title}</h3>
              {embed.description ? (
                <p className="text-label font-normal text-fg-secondary">
                  <Markdown text={embed.description} now={now} />
                </p>
              ) : null}
              <dl className="flex flex-col gap-2">
                {embed.fields?.map((field) => (
                  <div key={field.name} className="flex flex-col gap-0.5">
                    <dt className="text-label font-semibold text-fg">
                      <Markdown text={field.name} now={now} />
                    </dt>
                    <dd className="num text-label leading-relaxed font-normal whitespace-pre-line text-fg-secondary">
                      <Markdown text={field.value} now={now} />
                    </dd>
                  </div>
                ))}
              </dl>
              {embed.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- community map asset
                <img src={embed.image.url} alt="" className="mt-1 h-16 w-full rounded-control object-cover" loading="lazy" />
              ) : null}
              {embed.footer ? <p className="text-[11px] text-fg-muted">{embed.footer.text}</p> : null}
            </div>
            {embed.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- community agent asset
              <img src={embed.thumbnail.url} alt="" className="size-12 shrink-0 rounded-control bg-surface-3 object-cover" loading="lazy" />
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
}

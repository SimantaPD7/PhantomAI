export function streamChat({
  message,
  sessionId,
  userId,
  history,
  onChunk,
  onPlan,
  onStage,
  onSearchDone,
  onDone,
  onError,
}) {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/chat/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId,
            userId,
            conversationHistory: history,
          }),
          signal: ctrl.signal,
        }
      );

      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        onError?.(e.error || `HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";

        for (const part of parts) {
          let event = "message",
            data = "";

          for (const line of part.trim().split("\n")) {
            if (line.startsWith("event:"))
              event = line.slice(6).trim();
            if (line.startsWith("data:"))
              data = line.slice(5).trim();
          }

          if (!data) continue;

          try {
            const p = JSON.parse(data);

            if (event === "chunk") onChunk?.(p.content);
            else if (event === "plan") onPlan?.(p.plan);
            else if (event === "stage") onStage?.(p);
            else if (event === "search_done") onSearchDone?.(p);
            else if (event === "done") onDone?.(p);
            else if (event === "error") onError?.(p.message);
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") onError?.(err.message);
    }
  })();

  return () => ctrl.abort();
}
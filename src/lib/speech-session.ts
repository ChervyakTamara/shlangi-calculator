export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface SpeechRecognitionConstructor { new(): SpeechRecognitionLike }

export function startSpeechSession(
  Recognition: SpeechRecognitionConstructor,
  callbacks: { onText(text: string): void; onError(error: string): void; onStop(): void },
  silenceMs = 5000,
): () => void {
  const recognition = new Recognition();
  recognition.lang = "ru-RU";
  recognition.interimResults = true;
  recognition.continuous = true;
  let active = true;
  let prefix = "";
  let sessionText = "";
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;

  function finish() {
    if (!active) return;
    active = false;
    clearTimeout(silenceTimer);
    clearTimeout(restartTimer);
    // Retain the final recognition result delivered by stop().
    recognition.onend = null;
    recognition.onspeechstart = null;
    recognition.onspeechend = null;
    recognition.onerror = null;
    try { recognition.stop(); } catch { /* Already stopped by the browser. */ }
    callbacks.onStop();
  }
  function waitForSpeech() {
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(finish, silenceMs);
  }
  recognition.onspeechstart = () => { if (active) clearTimeout(silenceTimer); };
  recognition.onspeechend = () => { if (active) waitForSpeech(); };
  recognition.onresult = (event) => {
    sessionText = Array.from(event.results, (result) => result[0].transcript).join(" ").trim();
    callbacks.onText([prefix, sessionText].filter(Boolean).join(" "));
    if (active) waitForSpeech();
  };
  recognition.onerror = ({ error }) => {
    if (!active || error === "no-speech") return;
    callbacks.onError(error === "not-allowed"
      ? "Разреши доступ к микрофону в настройках браузера."
      : `Не удалось распознать речь (${error}). Попробуй ещё раз или введи текст вручную.`);
    finish();
  };
  recognition.onend = () => {
    if (!active) return;
    // Some browsers stop even in continuous mode: resume within the same pause.
    prefix = [prefix, sessionText].filter(Boolean).join(" ");
    sessionText = "";
    restartTimer = setTimeout(() => {
      if (!active) return;
      try { recognition.start(); }
      catch { callbacks.onError("Не удалось продолжить запись. Нажми «Диктовать» ещё раз."); finish(); }
    }, 150);
  };
  waitForSpeech();
  try { recognition.start(); }
  catch (error) { finish(); throw error; }
  return finish;
}

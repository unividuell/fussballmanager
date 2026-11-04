import "@fontsource/vt323";
import "@fontsource/press-start-2p";
import "./ui/theme/theme.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { GameController } from "./ui/controller.svelte";
import type { PrefsStorage } from "./ui/logic/options";
import { SaveStore } from "./storage/store";
import { createChiptune } from "./ui/sound";

function localPrefs(): PrefsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function browserStore(): SaveStore | null {
  try {
    return typeof indexedDB === "undefined" ? null : new SaveStore(indexedDB);
  } catch {
    return null;
  }
}

mount(App, { target: document.getElementById("app")!, props: { controller: new GameController({ store: browserStore(), prefs: localPrefs(), sound: createChiptune() }) } });

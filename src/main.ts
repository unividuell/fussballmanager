import "@fontsource/vt323";
import "@fontsource/press-start-2p";
import "./ui/theme/theme.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { GameController } from "./ui/controller.svelte";
import type { PrefsStorage } from "./ui/logic/options";
import { createChiptune } from "./ui/sound";

function localPrefs(): PrefsStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

mount(App, { target: document.getElementById("app")!, props: { controller: new GameController({ prefs: localPrefs(), sound: createChiptune() }) } });

import "@fontsource/vt323";
import "@fontsource/press-start-2p";
import "./ui/theme/theme.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { GameController } from "./ui/controller.svelte";

mount(App, { target: document.getElementById("app")!, props: { controller: new GameController() } });
